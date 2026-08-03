import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideIcon,
  type LucideProps,
} from "lucide-react"

/**
 * Ícono de archivo según su formato (por extensión, con fallback al mimeType).
 * Monocromo — la distinción es por forma, acorde a la identidad editorial (no
 * metemos color por tipo para no ensuciar la paleta).
 */
function pickIcon(name: string, mimeType?: string): LucideIcon {
  const dot = name.lastIndexOf(".")
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ""
  const mt = mimeType ?? ""

  if (ext === "pdf" || mt === "application/pdf") return FileText
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext) || mt.startsWith("audio/"))
    return FileAudio
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext) || mt.startsWith("video/"))
    return FileVideo
  if (
    ["zip", "rar", "7z", "tar", "gz", "dmg", "iso", "exe"].includes(ext) ||
    mt === "application/zip" ||
    mt.includes("compressed") ||
    mt.includes("diskimage")
  )
    return FileArchive
  if (
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "bmp"].includes(ext) ||
    mt.startsWith("image/")
  )
    return FileImage
  if (["xls", "xlsx", "csv"].includes(ext) || mt.includes("spreadsheet")) return FileSpreadsheet
  if (["doc", "docx", "txt", "rtf"].includes(ext) || mt.includes("word")) return FileText
  return File
}

type Props = { name: string; mimeType?: string } & LucideProps

export function FileTypeIcon({ name, mimeType, ...props }: Props) {
  const Icon = pickIcon(name, mimeType)
  return <Icon {...props} />
}
