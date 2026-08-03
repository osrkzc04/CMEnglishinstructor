/**
 * Genera los ZIP de instaladores (Windows/PC y Mac por SEPARADO) a partir del
 * drive de contenido, en una carpeta de staging que replica la estructura del
 * origen — para que luego `import-materials-remote` los suba con su mapeo de
 * siempre (nivel → ProgramLevel), en una subcarpeta "Instaladores".
 *
 * Por qué zip separado por OS: el estudiante descarga solo lo de su sistema, y
 * el repositorio muestra 1 archivo por instalador en vez de miles de archivos
 * internos del bundle (contadores coherentes).
 *
 * Por cada nivel busca la carpeta de instalador PC (nombre termina en " PC") y
 * la MAC (" MAC") y las comprime con 7-Zip (formato zip, zip64 → soporta >4GB,
 * modo store -mx=0 = rápido, sin recomprimir binarios) en:
 *   <out>/<sourceDir>/<levelDir>/Instaladores/<Base> - Windows.zip
 *   <out>/<sourceDir>/<levelDir>/Instaladores/<Base> - Mac.zip
 *
 * Después:
 *   pnpm materials:import:remote -- --base-url ... --source "<out>" \
 *     --email ... --password ... --chunked
 *
 * Uso:
 *   pnpm tsx scripts/zip-installers.ts --source "E:/CONTENIDO PLATAFORMA" --out "E:/STAGING_ZIPS"
 *   [--7z "C:/Program Files/7-Zip/7z.exe"] [--only life] [--dry-run]
 *
 * Idempotente: salta un zip que ya exista en el destino (borrá el archivo para
 * regenerarlo). OJO: <out> necesita ~el mismo espacio que los instaladores.
 */

import path from "node:path"
import fs from "node:fs/promises"
import { existsSync } from "node:fs"
import { spawn } from "node:child_process"
import { MANIFEST, JUNK_DIRS } from "./lib/materials-mapping"

// Salida ASCII-safe (terminales Windows cp850/437).
const ASCII_MAP: Record<string, string> = {
  "─": "-",
  "→": "->",
  "✓": "OK",
  "✗": "X",
  "⚠": "!",
  "📦": "",
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ñ: "n",
  Á: "A",
  É: "E",
  Í: "I",
  Ó: "O",
  Ú: "U",
  Ñ: "N",
}
function toAscii(s: string): string {
  let out = ""
  for (const ch of s) out += ASCII_MAP[ch] ?? (ch.codePointAt(0)! < 128 ? ch : "?")
  return out
}
for (const m of ["log", "warn", "error"] as const) {
  const orig = console[m].bind(console)
  console[m] = (...args: unknown[]) =>
    orig(...args.map((a) => (typeof a === "string" ? toAscii(a) : a)))
}

// -----------------------------------------------------------------------------
//  Args
// -----------------------------------------------------------------------------

const argv = process.argv.slice(2)
const hasFlag = (n: string) => argv.includes(`--${n}`)
const getOpt = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const SOURCE = getOpt("source")
const OUT = getOpt("out")
const ONLY = getOpt("only")?.toLowerCase()
const DRY_RUN = hasFlag("dry-run")
const SEVENZIP =
  getOpt("7z") ??
  ["C:/Program Files/7-Zip/7z.exe", "C:/Program Files (x86)/7-Zip/7z.exe"].find((p) =>
    existsSync(p),
  ) ??
  "7z"

const stats = { created: 0, skipped: 0, errors: 0 }

// -----------------------------------------------------------------------------
//  Detección de carpetas de instalador PC / MAC dentro de un nivel
// -----------------------------------------------------------------------------

/** Busca (shallowest-first) la carpeta raíz PC (" PC") y MAC (" MAC") del nivel. */
async function findInstallerRoots(levelDir: string): Promise<{ pc?: string; mac?: string }> {
  let pc: string | undefined
  let mac: string | undefined

  async function bfs(dir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    const subdirs: string[] = []
    for (const e of entries) {
      if (!e.isDirectory() || JUNK_DIRS.has(e.name)) continue
      const full = path.join(dir, e.name)
      const u = e.name.toUpperCase()
      if (!mac && u.endsWith(" MAC")) mac = full
      else if (!pc && u.endsWith(" PC")) pc = full
      else subdirs.push(full)
    }
    if (pc && mac) return
    for (const s of subdirs) {
      if (pc && mac) return
      await bfs(s)
    }
  }

  await bfs(levelDir)
  return { pc, mac }
}

const baseName = (root: string) => path.basename(root).replace(/\s+(PC|MAC)$/i, "")

function run7z(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(SEVENZIP, args, { cwd, stdio: "inherit" })
    p.on("error", reject)
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`7z salió con código ${code}`)),
    )
  })
}

/** Comprime `root` (carpeta) en `zipAbs` con 7-Zip (store, zip64). */
async function zipFolder(root: string, zipAbs: string, label: string): Promise<void> {
  if (existsSync(zipAbs)) {
    console.log(`  = ${label} (ya existe, saltado)`)
    stats.skipped++
    return
  }
  if (DRY_RUN) {
    console.log(`  📦 ${label}  <-  ${root}`)
    stats.created++
    return
  }
  await fs.mkdir(path.dirname(zipAbs), { recursive: true })
  console.log(`  📦 ${label}`)
  // cwd = padre del root + basename relativo → dentro del zip queda "<root>/...".
  try {
    await run7z(
      ["a", "-tzip", "-mx=0", "-bso0", "-bsp1", zipAbs, path.basename(root)],
      path.dirname(root),
    )
    stats.created++
    console.log(`  ✓ ${label}`)
  } catch (err) {
    stats.errors++
    // Limpia el zip parcial para que un re-run lo regenere.
    await fs.rm(zipAbs, { force: true }).catch(() => {})
    console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`)
  }
}

// -----------------------------------------------------------------------------
//  Main
// -----------------------------------------------------------------------------

async function processLevel(sourceDir: string, levelDir: string, stagingLevelDir: string) {
  const { pc, mac } = await findInstallerRoots(levelDir)
  if (!pc && !mac) return // nivel sin instaladores (p. ej. solo PDF)

  const base = baseName(pc ?? mac!)
  const instDir = path.join(stagingLevelDir, "Instaladores")

  if (pc) await zipFolder(pc, path.join(instDir, `${base} - Windows.zip`), `${base} - Windows.zip`)
  if (mac) await zipFolder(mac, path.join(instDir, `${base} - Mac.zip`), `${base} - Mac.zip`)
}

async function main() {
  if (!SOURCE || !OUT) {
    console.error(
      'Uso: --source "E:/CONTENIDO PLATAFORMA" --out "E:/STAGING_ZIPS" [--7z ...] [--only x] [--dry-run]',
    )
    process.exit(1)
  }
  if (!existsSync(SOURCE)) {
    console.error(`No existe el directorio fuente: ${SOURCE}`)
    process.exit(1)
  }

  console.log("─".repeat(70))
  console.log(`📦 Zipeo de instaladores ${DRY_RUN ? "(DRY-RUN)" : ""}`)
  console.log(`   Fuente:  ${SOURCE}`)
  console.log(`   Staging: ${OUT}`)
  console.log(`   7-Zip:   ${SEVENZIP}`)
  if (ONLY) console.log(`   Filtro:  "${ONLY}"`)
  console.log("─".repeat(70))

  const entries = MANIFEST.filter((m) => !ONLY || m.programName.toLowerCase().includes(ONLY))

  for (const m of entries) {
    const sourceDir = path.join(SOURCE, m.sourceDir)
    if (!existsSync(sourceDir)) continue
    console.log(`\n══ ${m.programName} ══`)

    if (m.kind === "single-level") {
      await processLevel(sourceDir, sourceDir, path.join(OUT, m.sourceDir))
      continue
    }

    const children = (await fs.readdir(sourceDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !JUNK_DIRS.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const child of children) {
      console.log(`  ${child.name}`)
      await processLevel(
        sourceDir,
        path.join(sourceDir, child.name),
        path.join(OUT, m.sourceDir, child.name),
      )
    }
  }

  console.log("\n" + "─".repeat(70))
  console.log(DRY_RUN ? "✅ Dry-run completo." : "✅ Zipeo completo.")
  console.log(`   Zips creados: ${stats.created}`)
  console.log(`   Saltados:     ${stats.skipped}`)
  console.log(`   Errores:      ${stats.errors}`)
  console.log("─".repeat(70))
  if (stats.errors > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error("\n✗ Error:", err instanceof Error ? err.message : err)
  process.exit(1)
})
