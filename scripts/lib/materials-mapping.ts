/**
 * Mapeo compartido entre los importadores de materiales (local a disco y
 * remoto por HTTP). Define cómo las carpetas del drive de contenido
 * (`E:\CONTENIDO PLATAFORMA`) se corresponden con el catálogo académico
 * (`Course → Program → ProgramLevel`), además de utilidades de nombres,
 * MIME y filtrado de basura del sistema de archivos.
 *
 * Mantener acá la ÚNICA fuente de verdad del mapeo evita que los dos
 * importadores se desincronicen.
 */

import path from "node:path"

// -----------------------------------------------------------------------------
//  Manifiesto: carpeta de disco → programa (+ cómo resolver niveles).
//  "per-level":    cada subcarpeta de `sourceDir` es un ProgramLevel; su
//                  subárbol (INSTALL/, PDF/, AUDIOS/, …) se replica bajo la raíz.
//  "single-level": todo `sourceDir` mapea a un único nivel `levelCode`; sus
//                  subcarpetas se importan como subcarpetas de la raíz.
// -----------------------------------------------------------------------------

export type ManifestEntry =
  | { sourceDir: string; programName: string; kind: "per-level" }
  | { sourceDir: string; programName: string; kind: "single-level"; levelCode: string }

export const MANIFEST: ManifestEntry[] = [
  {
    sourceDir: "Business English Pearson Education Market Leader",
    programName: "Market Leader",
    kind: "per-level",
  },
  {
    sourceDir: "Business English Pearson Education Specialization",
    programName: "Specialization",
    kind: "per-level",
  },
  {
    sourceDir: "General English National Geographic Learning Life",
    programName: "Life",
    kind: "per-level",
  },
  {
    sourceDir: "General English National Geographic Learning Perspectives",
    programName: "Perspectives",
    kind: "per-level",
  },
  {
    sourceDir: "General English National Geographic Learning Time Zones",
    programName: "Time Zones",
    kind: "per-level",
  },
  // Kids: en disco son "Kids Reading" y "Kids Writing"; en catálogo es un solo
  // nivel "Integral". Ambas quedan como subcarpetas bajo la raíz del nivel.
  {
    sourceDir: "Kids Learning",
    programName: "Kids English",
    kind: "single-level",
    levelCode: "Integral",
  },
  // Fuera de alcance: "PAGINA WEB" (plantillas operativas, no material por
  // nivel) y "Vistas/Español" (sin contenido en el drive).
]

// -----------------------------------------------------------------------------
//  Basura del sistema de archivos (macOS / Windows) que no se importa.
// -----------------------------------------------------------------------------

export const JUNK_DIRS = new Set(["__MACOSX", ".Trashes", ".Spotlight-V100", ".fseventsd"])

export function isJunkFile(name: string): boolean {
  return (
    name === ".DS_Store" || name === "Thumbs.db" || name === "desktop.ini" || name.startsWith("._")
  )
}

// -----------------------------------------------------------------------------
//  MIME por extensión — mapa mínimo, sin dependencias. Fallback octet-stream.
// -----------------------------------------------------------------------------

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".dmg": "application/x-apple-diskimage",
  ".dll": "application/octet-stream",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ai": "application/postscript",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".html": "text/html",
  ".txt": "text/plain",
}

export function mimeFor(name: string): string {
  return MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream"
}

// -----------------------------------------------------------------------------
//  Nombres: sanea a lo que acepta NameSchema (NTFS/macOS-safe, máx 120).
// -----------------------------------------------------------------------------

const FORBIDDEN = /[\\/:*?"<>|]/g

export function sanitizeName(name: string): string {
  let n = name.replace(FORBIDDEN, "_").trim()
  if (n === "" || n === "." || n === "..") n = "_"
  if (n.length > 120) {
    const ext = path.extname(n)
    n = n.slice(0, 120 - ext.length) + ext
  }
  return n
}

// -----------------------------------------------------------------------------
//  Resolución de nivel: carpeta de disco → ProgramLevel.code
// -----------------------------------------------------------------------------

export function normalize(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
}

/**
 * Resuelve el `ProgramLevel.code` de una carpeta de nivel en disco.
 *   - "NIVEL 3" → "3"
 *   - "PRE INTERMEDIATE" → "Pre-Intermediate" (match normalizado por code/name)
 *   - "USING SOCIAL MEDIA" → "Using Social Media"
 *
 * Prioridad estricta: match exacto por code, luego por name. El fallback
 * "termina en" solo aplica si no hubo exacto y es inequívoco — si no,
 * "INTERMEDIATE" matchearía también "Pre-Intermediate"/"Upper-Intermediate".
 */
export function resolveLevelCode(
  dirName: string,
  levels: { code: string; name: string }[],
): string | null {
  const nivel = dirName.match(/^NIVEL\s*(\d+)$/i)
  if (nivel) {
    return levels.find((l) => l.code === nivel[1])?.code ?? null
  }
  const norm = normalize(dirName)
  const byCode = levels.find((l) => normalize(l.code) === norm)
  if (byCode) return byCode.code
  const byName = levels.find((l) => normalize(l.name) === norm)
  if (byName) return byName.code
  const ends = levels.filter((l) => normalize(l.name).endsWith(` ${norm}`))
  return ends.length === 1 ? ends[0]!.code : null
}
