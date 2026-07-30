/**
 * Carga inicial masiva del repositorio de materiales.
 *
 * Herramienta ONE-SHOT pensada para correr EN EL SERVIDOR DE PRODUCCIÓN sobre
 * el drive con el contenido de los cursos (~131 GB). Lee un directorio fuente
 * local y escribe directo a storage (disco) + BD, SIN pasar por HTTP — así no
 * la afecta ningún límite de proxy, body ni timeout. Después de esta carga, el
 * contenido se administra manualmente desde la app.
 *
 * NB (patrón de este repo): los scripts standalone NO importan la capa
 * `@/lib` / `src/modules` porque esos módulos usan `import "server-only"`, que
 * lanza fuera de un Server Component. Por eso reimplementamos aquí, inline, la
 * escritura a disco (misma lógica que `LocalAdapter.uploadStream`) y las
 * verificaciones de idempotencia (misma lógica que `queries.ts`), leyendo la
 * config desde `process.env`. El comportamiento — patrón de `storageKey`,
 * autocreación de raíces por nivel, saltar duplicados — es idéntico al del
 * route handler `src/app/api/materials/upload/route.ts`.
 *
 * Uso:
 *   pnpm tsx --env-file=.env scripts/import-materials.ts --source "/mnt/contenido/CONTENIDO PLATAFORMA"
 *   pnpm materials:import -- --source "E:/CONTENIDO PLATAFORMA" --dry-run
 *   pnpm materials:import -- --source "..." --only "Life"
 *
 * Flags:
 *   --source <path>   (requerido) directorio raíz del contenido en este host.
 *   --dry-run         no escribe nada; lista lo que haría y detecta niveles no mapeados.
 *   --only <texto>    limita a los programas cuyo nombre contenga <texto> (case-insensitive).
 *
 * Idempotente / reanudable: salta carpetas y archivos ya existentes (no
 * soft-deleted). Si la carga se corta, volver a correr el mismo comando retoma
 * donde quedó.
 */

import { PrismaClient, Role, UserStatus } from "@prisma/client"
import { randomBytes } from "node:crypto"
import path from "node:path"
import fs from "node:fs/promises"
import { createReadStream, createWriteStream } from "node:fs"
import { pipeline } from "node:stream/promises"
import {
  MANIFEST,
  JUNK_DIRS,
  isJunkFile,
  mimeFor,
  sanitizeName,
  resolveLevelCode,
} from "./lib/materials-mapping"

// Salida ASCII-safe: las terminales de Windows (cp850/437) no renderizan
// box-drawing, emojis ni acentos → se normalizan a ASCII al imprimir.
const ASCII_MAP: Record<string, string> = {
  "─": "-",
  "═": "=",
  "→": "->",
  "—": "-",
  "…": "...",
  "•": "*",
  "✓": "OK",
  "✗": "X",
  "⚠": "!",
  "✅": "OK",
  "📦": "",
  "📁": "[dir]",
  "📄": "[file]",
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ñ: "n",
  ü: "u",
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

const prisma = new PrismaClient()

// -----------------------------------------------------------------------------
//  Args + config de entorno
// -----------------------------------------------------------------------------

const argv = process.argv.slice(2)
function hasFlag(name: string): boolean {
  return argv.includes(`--${name}`)
}
function getOpt(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const SOURCE = getOpt("source")
const DRY_RUN = hasFlag("dry-run")
const ONLY = getOpt("only")?.toLowerCase()

const STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "local"
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH ?? "./storage"

// Contadores globales para el resumen final.
const stats = { foldersCreated: 0, filesUploaded: 0, filesSkipped: 0, bytes: 0 }
let totalFiles = 0
let seenFiles = 0

// -----------------------------------------------------------------------------
//  Helpers de storage / idempotencia (mirror de LocalAdapter+queries)
//  (mapeo, nombres y MIME viven en ./lib/materials-mapping)
// -----------------------------------------------------------------------------

function resolveStorageAbs(key: string): string {
  const root = path.resolve(LOCAL_STORAGE_PATH)
  const normalized = path.normalize(key).replace(/^(\.\.[/\\])+/, "")
  return path.join(root, normalized)
}

/** Streamea un archivo a disco sin buffering; limpia el parcial ante error. */
async function writeToStorage(key: string, srcPath: string): Promise<number> {
  const full = resolveStorageAbs(key)
  await fs.mkdir(path.dirname(full), { recursive: true })
  const source = createReadStream(srcPath)
  const sink = createWriteStream(full)
  let size = 0
  source.on("data", (chunk: Buffer | string) => {
    size += Buffer.byteLength(chunk)
  })
  try {
    await pipeline(source, sink)
  } catch (err) {
    await fs.unlink(full).catch(() => {})
    throw err
  }
  return size
}

async function findFolder(parentId: string, name: string): Promise<{ id: string } | null> {
  return prisma.materialFolder.findFirst({
    where: { parentId, name, deletedAt: null },
    select: { id: true },
  })
}
async function findFile(folderId: string, name: string): Promise<{ id: string } | null> {
  return prisma.materialFile.findFirst({
    where: { folderId, name, deletedAt: null },
    select: { id: true },
  })
}

// -----------------------------------------------------------------------------
//  Núcleo: importar recursivamente el CONTENIDO de un dir dentro de una carpeta
// -----------------------------------------------------------------------------

async function importDir(
  srcDir: string,
  targetFolderId: string,
  directorId: string,
  indent = "  ",
) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true })
  // Orden estable: carpetas y archivos alfabético (reanudación predecible).
  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (JUNK_DIRS.has(entry.name)) continue
      const name = sanitizeName(entry.name)
      let folder = await findFolder(targetFolderId, name)
      if (!folder) {
        if (DRY_RUN) {
          console.log(`${indent}📁 [crear] ${name}/`)
          folder = { id: `dry:${targetFolderId}/${name}` }
        } else {
          folder = await prisma.materialFolder.create({
            data: {
              parentId: targetFolderId,
              name,
              programLevelId: await levelOf(targetFolderId),
              createdById: directorId,
            },
            select: { id: true },
          })
          stats.foldersCreated++
        }
      }
      await importDir(path.join(srcDir, entry.name), folder.id, directorId, indent + "  ")
    } else if (entry.isFile()) {
      if (isJunkFile(entry.name)) continue
      seenFiles++
      const name = sanitizeName(entry.name)
      const srcPath = path.join(srcDir, entry.name)

      if (!DRY_RUN) {
        const existing = await findFile(targetFolderId, name)
        if (existing) {
          stats.filesSkipped++
          continue
        }
      }

      const progress = `[${seenFiles}/${totalFiles}]`
      if (DRY_RUN) {
        const { size } = await fs.stat(srcPath)
        console.log(`${indent}📄 ${progress} [subir] ${name} (${mb(size)})`)
        continue
      }

      const suffix = randomBytes(8).toString("hex")
      const safeName = name.replace(/[^\w.\-()\s]/g, "_")
      const storageKey = `materials/${targetFolderId}/${suffix}_${safeName}`

      const size = await writeToStorage(storageKey, srcPath)
      await prisma.materialFile.create({
        data: {
          folderId: targetFolderId,
          name,
          storageKey,
          size: BigInt(size),
          mimeType: mimeFor(name),
          uploadedById: directorId,
        },
      })
      stats.filesUploaded++
      stats.bytes += size
      console.log(`${indent}✓ ${progress} ${name} (${mb(size)})`)
    }
  }
}

// Cache programLevelId por carpeta (para heredarlo al crear subcarpetas).
const levelCache = new Map<string, string>()
async function levelOf(folderId: string): Promise<string> {
  const hit = levelCache.get(folderId)
  if (hit) return hit
  const folder = await prisma.materialFolder.findUniqueOrThrow({
    where: { id: folderId },
    select: { programLevelId: true },
  })
  levelCache.set(folderId, folder.programLevelId)
  return folder.programLevelId
}

/** Obtiene o crea la carpeta raíz de un nivel (mirror de `ensureLevelRoot`). */
async function ensureRoot(
  programLevelId: string,
  name: string,
  directorId: string,
): Promise<string> {
  const existing = await prisma.materialFolder.findFirst({
    where: { programLevelId, parentId: null, deletedAt: null },
    select: { id: true },
  })
  if (existing) {
    levelCache.set(existing.id, programLevelId)
    return existing.id
  }
  if (DRY_RUN) {
    const fake = `dry-root:${programLevelId}`
    levelCache.set(fake, programLevelId)
    return fake
  }
  const created = await prisma.materialFolder.create({
    data: { programLevelId, parentId: null, name, createdById: directorId },
    select: { id: true },
  })
  stats.foldersCreated++
  levelCache.set(created.id, programLevelId)
  return created.id
}

// -----------------------------------------------------------------------------
//  Pre-conteo de archivos (para el progreso [n/total])
// -----------------------------------------------------------------------------

async function countFiles(dir: string): Promise<number> {
  let n = 0
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) {
      if (JUNK_DIRS.has(e.name)) continue
      n += await countFiles(path.join(dir, e.name))
    } else if (e.isFile() && !isJunkFile(e.name)) {
      n++
    }
  }
  return n
}

function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}
function gb(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`
}

async function exists(p: string): Promise<boolean> {
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
  if (!SOURCE) {
    console.error("Falta --source. Uso:")
    console.error(
      '  pnpm tsx --env-file=.env scripts/import-materials.ts --source "/ruta/CONTENIDO PLATAFORMA"',
    )
    process.exit(1)
  }
  if (STORAGE_DRIVER !== "local") {
    console.error(`Esta herramienta solo soporta STORAGE_DRIVER=local (actual: ${STORAGE_DRIVER}).`)
    process.exit(1)
  }
  if (!(await exists(SOURCE))) {
    console.error(`No existe el directorio fuente: ${SOURCE}`)
    process.exit(1)
  }

  console.log("─".repeat(70))
  console.log(`📦 Carga de materiales ${DRY_RUN ? "(DRY-RUN — sin escrituras)" : ""}`)
  console.log(`   Fuente:  ${SOURCE}`)
  console.log(`   Storage: ${path.resolve(LOCAL_STORAGE_PATH)}`)
  if (ONLY) console.log(`   Filtro:  programas que contengan "${ONLY}"`)
  console.log("─".repeat(70))

  // Director para createdById / uploadedById.
  const email = process.env.SUPER_ADMIN_EMAIL?.trim()
  const director =
    (email
      ? await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
      : null) ??
    (await prisma.user.findFirst({
      where: { role: Role.DIRECTOR, status: UserStatus.ACTIVE },
      select: { id: true, role: true },
    }))
  if (!director) {
    console.error("No hay un DIRECTOR activo (ni SUPER_ADMIN_EMAIL válido). Corre el seed primero.")
    process.exit(1)
  }

  // Filtra el manifiesto por --only y verifica que la carpeta exista en disco.
  const entries = MANIFEST.filter((m) => !ONLY || m.programName.toLowerCase().includes(ONLY))

  // Pre-conteo global para el progreso.
  console.log("→ Contando archivos…")
  for (const m of entries) {
    const dir = path.join(SOURCE, m.sourceDir)
    if (await exists(dir)) totalFiles += await countFiles(dir)
  }
  console.log(`   ${totalFiles} archivos a procesar.\n`)

  for (const m of entries) {
    const sourceDir = path.join(SOURCE, m.sourceDir)
    if (!(await exists(sourceDir))) {
      console.warn(`⚠ No existe en disco, se omite: ${m.sourceDir}`)
      continue
    }

    const program = await prisma.program.findFirst({
      where: { name: m.programName },
      select: { id: true, name: true, levels: { select: { id: true, code: true, name: true } } },
    })
    if (!program) {
      console.warn(`⚠ Programa no encontrado en el catálogo: "${m.programName}" — se omite.`)
      continue
    }

    console.log(`\n══ ${program.name} ══`)

    if (m.kind === "single-level") {
      const level = program.levels.find((l) => l.code === m.levelCode)
      if (!level) {
        console.warn(`⚠ Nivel "${m.levelCode}" no existe en "${program.name}" — se omite.`)
        continue
      }
      const rootId = await ensureRoot(level.id, `${program.name} ${level.code}`, director.id)
      console.log(`  Nivel ${level.code} → raíz ${DRY_RUN ? "(dry)" : rootId}`)
      await importDir(sourceDir, rootId, director.id)
      continue
    }

    // kind === "per-level": cada subcarpeta es un nivel.
    const children = (await fs.readdir(sourceDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !JUNK_DIRS.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const child of children) {
      const code = resolveLevelCode(child.name, program.levels)
      if (!code) {
        console.warn(`  ⚠ Nivel NO MAPEADO: "${child.name}" en "${program.name}" — se omite.`)
        continue
      }
      const level = program.levels.find((l) => l.code === code)!
      const rootId = await ensureRoot(level.id, `${program.name} ${level.code}`, director.id)
      console.log(`  ${child.name} → nivel ${level.code} (raíz ${DRY_RUN ? "dry" : rootId})`)
      await importDir(path.join(sourceDir, child.name), rootId, director.id)
    }
  }

  console.log("\n" + "─".repeat(70))
  console.log(DRY_RUN ? "✅ Dry-run completo (no se escribió nada)." : "✅ Carga completa.")
  if (!DRY_RUN) {
    console.log(`   Carpetas creadas: ${stats.foldersCreated}`)
    console.log(`   Archivos subidos: ${stats.filesUploaded}`)
    console.log(`   Archivos saltados (ya existían): ${stats.filesSkipped}`)
    console.log(`   Total transferido: ${gb(stats.bytes)}`)
  }
  console.log("─".repeat(70))
}

main()
  .catch((err) => {
    console.error("\n✗ Error:", err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
