/**
 * Carga inicial de materiales por HTTP contra la URL de PRODUCCIÓN.
 *
 * Cliente externo que corre en la máquina donde está el drive de contenido,
 * se autentica contra la app desplegada (Dokploy) y sube todo llamando a sus
 * endpoints. NO requiere SSH, ni cambios de Dockerfile, ni acceso al servidor:
 * reutiliza el pipeline de storage/auth que ya vive en la aplicación.
 *
 *   1) Login con credenciales de un DIRECTOR (flujo CSRF + callback de Auth.js).
 *   2) GET /api/materials/levels → resuelve, con `resolveLevelCode` compartido,
 *      cada carpeta de disco a su ProgramLevel.
 *   3) POST /api/materials/ensure-folder → recrea el árbol (INSTALL/, PDF/, …)
 *      y obtiene el folderId de cada carpeta.
 *   4) POST /api/materials/upload?folderId=&name= → sube cada archivo por stream.
 *      El 409 ("ya existe") se trata como saltado ⇒ la carga es REANUDABLE.
 *
 * Uso:
 *   pnpm materials:import:remote -- \
 *     --base-url https://app.cmenglishinstructor.com \
 *     --source "E:/CONTENIDO PLATAFORMA" \
 *     --email directora@... --password '...'
 *   (o exportar IMPORT_EMAIL / IMPORT_PASSWORD)
 *
 * Flags: --base-url, --source, --email, --password, --dry-run, --only <texto>,
 *        --concurrency <n> (default 4).
 */

import path from "node:path"
import fs from "node:fs/promises"
import { createReadStream } from "node:fs"
import { Readable } from "node:stream"
import {
  MANIFEST,
  JUNK_DIRS,
  isJunkFile,
  mimeFor,
  sanitizeName,
  resolveLevelCode,
} from "./lib/materials-mapping"

// -----------------------------------------------------------------------------
//  Args + config
// -----------------------------------------------------------------------------

const argv = process.argv.slice(2)
const hasFlag = (n: string) => argv.includes(`--${n}`)
const getOpt = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const BASE = (getOpt("base-url") ?? process.env.IMPORT_BASE_URL ?? "").replace(/\/+$/, "")
const SOURCE = getOpt("source")
const EMAIL = getOpt("email") ?? process.env.IMPORT_EMAIL
const PASSWORD = getOpt("password") ?? process.env.IMPORT_PASSWORD
const DRY_RUN = hasFlag("dry-run")
const ONLY = getOpt("only")?.toLowerCase()
const CONCURRENCY = Math.max(1, Number(getOpt("concurrency") ?? 4))

const stats = { foldersEnsured: 0, uploaded: 0, skipped: 0, errors: 0, bytes: 0 }

// -----------------------------------------------------------------------------
//  Cookie jar + login (Auth.js credentials)
// -----------------------------------------------------------------------------

const jar = new Map<string, string>()
function storeCookies(res: Response) {
  const setCookies = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.()
  for (const sc of setCookies ?? []) {
    const pair = sc.split(";")[0] ?? ""
    const idx = pair.indexOf("=")
    if (idx < 0) continue
    const name = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1).trim()
    if (name) jar.set(name, value)
  }
}
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ")

async function login(): Promise<{ email: string; role: string }> {
  if (!EMAIL || !PASSWORD)
    throw new Error("Faltan --email / --password (o IMPORT_EMAIL / IMPORT_PASSWORD)")

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } })
  storeCookies(csrfRes)
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  const form = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: BASE,
    json: "true",
  })
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: form.toString(),
    redirect: "manual",
  })
  storeCookies(res)

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: cookieHeader() },
  })
  const session = (await sessionRes.json().catch(() => null)) as {
    user?: { email: string; role: string }
  } | null
  if (!session?.user) {
    throw new Error("Login rechazado: credenciales inválidas o usuario no DIRECTOR/ACTIVE.")
  }
  return session.user
}

// -----------------------------------------------------------------------------
//  Endpoints de materiales
// -----------------------------------------------------------------------------

async function fetchLevels(): Promise<Map<string, { code: string; name: string }[]>> {
  const res = await fetch(`${BASE}/api/materials/levels`, { headers: { cookie: cookieHeader() } })
  if (!res.ok) throw new Error(`GET /api/materials/levels → ${res.status}`)
  const data = (await res.json()) as {
    programName: string
    levels: { code: string; name: string }[]
  }[]
  return new Map(data.map((p) => [p.programName, p.levels]))
}

const folderCache = new Map<string, string>()
async function ensureFolder(
  programName: string,
  levelCode: string,
  segments: string[],
): Promise<string> {
  const key = `${programName}|${levelCode}|${segments.join("/")}`
  const cached = folderCache.get(key)
  if (cached) return cached

  const res = await fetch(`${BASE}/api/materials/ensure-folder`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ programName, levelCode, segments }),
  })
  if (res.status === 401) {
    await login()
    return ensureFolder(programName, levelCode, segments)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`ensure-folder ${key} → ${res.status} ${body}`)
  }
  const { folderId } = (await res.json()) as { folderId: string }
  folderCache.set(key, folderId)
  stats.foldersEnsured++
  return folderId
}

async function uploadFile(folderId: string, name: string, filePath: string, size: number) {
  const url = `${BASE}/api/materials/upload?folderId=${encodeURIComponent(folderId)}&name=${encodeURIComponent(name)}`
  const doReq = () => {
    // `duplex: "half"` es obligatorio al enviar un body en streaming; no está
    // en los tipos DOM de RequestInit, por eso el cast.
    const init = {
      method: "POST",
      headers: { "content-type": mimeFor(name), cookie: cookieHeader() },
      body: Readable.toWeb(createReadStream(filePath)) as unknown as BodyInit,
      duplex: "half",
    }
    return fetch(url, init as RequestInit)
  }

  let res = await doReq()
  if (res.status === 401) {
    await login()
    res = await doReq()
  }
  if (res.status === 409) {
    stats.skipped++
    return
  }
  if (!res.ok) {
    stats.errors++
    const body = await res.text().catch(() => "")
    console.error(`  ✗ ${name} → ${res.status} ${body}`)
    return
  }
  stats.uploaded++
  stats.bytes += size
}

// -----------------------------------------------------------------------------
//  Recorrido del drive → jobs de archivos (asegurando carpetas en el camino)
// -----------------------------------------------------------------------------

type FileJob = { folderId: string; name: string; filePath: string; size: number; rel: string }
const jobs: FileJob[] = []

async function walk(
  dirPath: string,
  programName: string,
  levelCode: string,
  segments: string[],
  folderId: string,
) {
  const entries = (await fs.readdir(dirPath, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  for (const e of entries) {
    if (e.isDirectory()) {
      if (JUNK_DIRS.has(e.name)) continue
      const childSegments = [...segments, sanitizeName(e.name)]
      let childId = "(dry)"
      if (DRY_RUN) {
        console.log(`  📁 ${childSegments.join("/")}/`)
      } else {
        childId = await ensureFolder(programName, levelCode, childSegments)
      }
      await walk(path.join(dirPath, e.name), programName, levelCode, childSegments, childId)
    } else if (e.isFile()) {
      if (isJunkFile(e.name)) continue
      const st = await fs.stat(path.join(dirPath, e.name))
      jobs.push({
        folderId,
        name: sanitizeName(e.name),
        filePath: path.join(dirPath, e.name),
        size: st.size,
        rel: [...segments, e.name].join("/"),
      })
    }
  }
}

// -----------------------------------------------------------------------------
//  Pool de subida con concurrencia
// -----------------------------------------------------------------------------

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, i: number) => Promise<void>,
) {
  let next = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) break
      await worker(items[i]!, i)
    }
  })
  await Promise.all(runners)
}

// -----------------------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------------------

const gb = (b: number) => `${(b / 1_000_000_000).toFixed(2)} GB`
async function exists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

// -----------------------------------------------------------------------------
//  Main
// -----------------------------------------------------------------------------

async function main() {
  if (!BASE || !SOURCE) {
    console.error(
      "Uso: --base-url <url> --source <dir> [--email --password] [--dry-run] [--only x]",
    )
    process.exit(1)
  }
  if (!(await exists(SOURCE))) {
    console.error(`No existe el directorio fuente: ${SOURCE}`)
    process.exit(1)
  }

  console.log("─".repeat(70))
  console.log(`📦 Carga remota de materiales ${DRY_RUN ? "(DRY-RUN — sin escrituras)" : ""}`)
  console.log(`   Destino: ${BASE}`)
  console.log(`   Fuente:  ${SOURCE}`)
  if (ONLY) console.log(`   Filtro:  programas que contengan "${ONLY}"`)
  console.log("─".repeat(70))

  const user = await login()
  console.log(`✓ Autenticado como ${user.email} (${user.role})`)
  const levelsByProgram = await fetchLevels()

  const entries = MANIFEST.filter((m) => !ONLY || m.programName.toLowerCase().includes(ONLY))

  for (const m of entries) {
    const sourceDir = path.join(SOURCE, m.sourceDir)
    if (!(await exists(sourceDir))) {
      console.warn(`⚠ No existe en disco, se omite: ${m.sourceDir}`)
      continue
    }
    const levels = levelsByProgram.get(m.programName)
    if (!levels) {
      console.warn(`⚠ Programa no está en el catálogo: "${m.programName}" — se omite.`)
      continue
    }

    console.log(`\n══ ${m.programName} ══`)

    if (m.kind === "single-level") {
      const level = levels.find((l) => l.code === m.levelCode)
      if (!level) {
        console.warn(`⚠ Nivel "${m.levelCode}" no existe en "${m.programName}" — se omite.`)
        continue
      }
      const rootId = DRY_RUN ? "(dry)" : await ensureFolder(m.programName, level.code, [])
      console.log(`  Nivel ${level.code}`)
      await walk(sourceDir, m.programName, level.code, [], rootId)
      continue
    }

    // per-level: cada subcarpeta es un nivel.
    const children = (await fs.readdir(sourceDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !JUNK_DIRS.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const child of children) {
      const code = resolveLevelCode(child.name, levels)
      if (!code) {
        console.warn(`  ⚠ Nivel NO MAPEADO: "${child.name}" en "${m.programName}" — se omite.`)
        continue
      }
      console.log(`  ${child.name} → nivel ${code}`)
      const rootId = DRY_RUN ? "(dry)" : await ensureFolder(m.programName, code, [])
      await walk(path.join(sourceDir, child.name), m.programName, code, [], rootId)
    }
  }

  console.log(`\n→ ${jobs.length} archivos a subir.`)
  if (DRY_RUN) {
    console.log("\n✅ Dry-run completo (no se subió nada).")
    return
  }

  let done = 0
  await runPool(jobs, CONCURRENCY, async (job) => {
    await uploadFile(job.folderId, job.name, job.filePath, job.size)
    done++
    if (done % 25 === 0 || done === jobs.length) {
      console.log(
        `  [${done}/${jobs.length}] subidos=${stats.uploaded} saltados=${stats.skipped} errores=${stats.errors} (${gb(stats.bytes)})`,
      )
    }
  })

  console.log("\n" + "─".repeat(70))
  console.log("✅ Carga remota completa.")
  console.log(`   Carpetas aseguradas: ${stats.foldersEnsured}`)
  console.log(`   Archivos subidos:    ${stats.uploaded}`)
  console.log(`   Saltados (409):      ${stats.skipped}`)
  console.log(`   Errores:             ${stats.errors}`)
  console.log(`   Total transferido:   ${gb(stats.bytes)}`)
  console.log("─".repeat(70))
  if (stats.errors > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error("\n✗ Error:", err instanceof Error ? err.message : err)
  process.exit(1)
})
