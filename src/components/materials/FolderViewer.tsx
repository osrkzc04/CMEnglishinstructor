import Link from "next/link"
import type { Route } from "next"
import { ChevronRight, Download, FileText, Folder, Home } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FolderDetail } from "@/modules/materials/queries"

/**
 * Visor de materiales sin acciones de escritura — para docentes y estudiantes.
 * `basePath` define dónde linkean los breadcrumbs y las subcarpetas (ej.
 * `/docente/materiales` o `/estudiante/materiales`). El download de archivos
 * pega siempre al endpoint compartido `/api/materials/files/[id]/download`,
 * que valida el scope por rol.
 */
type Props = {
  folder: FolderDetail
  basePath: string
  rootLabel: string
}

export function FolderViewer({ folder, basePath, rootLabel }: Props) {
  return (
    <>
      <FolderTrail
        breadcrumb={folder.breadcrumb}
        levelName={folder.levelName}
        basePath={basePath}
        rootLabel={rootLabel}
      />

      <div className="my-4 flex items-center justify-between">
        <h2 className="text-foreground font-serif text-[20px] font-normal">{folder.name}</h2>
        <div className="text-text-3 text-[12.5px]">
          {folder.items.length} {folder.items.length === 1 ? "elemento" : "elementos"}
        </div>
      </div>

      {folder.items.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="Sin contenido"
          description="Aún no se han publicado archivos en esta carpeta."
        />
      ) : (
        <div className="border-border bg-surface overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-[120px]">Tamaño</TableHead>
                <TableHead className="w-[160px]">Publicado</TableHead>
                <TableHead className="w-[80px] text-right">Acción</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {folder.items.map((item) => (
                <TableRow key={`${item.kind}-${item.id}`}>
                  <TableCell>
                    {item.kind === "folder" ? (
                      <Link
                        href={`${basePath}/${item.id}` as Route}
                        className="group text-foreground inline-flex items-center gap-2.5"
                      >
                        <Folder
                          size={15}
                          strokeWidth={1.6}
                          className="text-text-3 group-hover:text-teal-500"
                        />
                        <span className="font-medium group-hover:text-teal-500">{item.name}</span>
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2.5">
                        <FileText size={15} strokeWidth={1.6} className="text-text-3" />
                        <span className="text-foreground">{item.name}</span>
                      </span>
                    )}
                    {item.kind === "folder" && (
                      <div className="text-text-3 mt-0.5 ml-[26px] text-[12px]">
                        {item.childFolderCount} carpetas · {item.fileCount} archivos
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-text-3 font-mono text-[12.5px]">
                    {item.kind === "file" ? formatBytes(item.size) : "—"}
                  </TableCell>
                  <TableCell className="text-text-3 text-[12.5px]">
                    {formatDate(item.kind === "file" ? item.uploadedAt : item.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.kind === "file" ? (
                      <a
                        href={`/api/materials/files/${item.id}/download`}
                        className="border-border bg-surface text-text-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors hover:border-teal-500 hover:text-teal-500"
                        aria-label={`Descargar ${item.name}`}
                        download
                      >
                        <Download size={12} strokeWidth={1.6} />
                        Descargar
                      </a>
                    ) : (
                      <span className="text-text-3 text-[12px]">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}

function FolderTrail({
  breadcrumb,
  levelName,
  basePath,
  rootLabel,
}: {
  breadcrumb: { id: string; name: string }[]
  levelName: string
  basePath: string
  rootLabel: string
}) {
  if (breadcrumb.length === 0) return null

  return (
    <nav
      aria-label="Ruta de la carpeta"
      className="text-text-3 flex flex-wrap items-center gap-1 text-[12.5px]"
    >
      <Link
        href={basePath as Route}
        className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
      >
        <Home size={11} strokeWidth={1.6} />
        {rootLabel}
      </Link>
      {breadcrumb.map((node, idx) => {
        const isLast = idx === breadcrumb.length - 1
        const label = idx === 0 ? levelName : node.name
        return (
          <span key={node.id} className="inline-flex items-center gap-1">
            <ChevronRight size={11} strokeWidth={1.6} className="text-text-3/60" />
            {isLast ? (
              <span className="text-text-2">{label}</span>
            ) : (
              <Link
                href={`${basePath}/${node.id}` as Route}
                className="hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

function formatBytes(bytes: bigint): string {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)} GB`
  return `${(n / 1024 ** 4).toFixed(2)} TB`
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(d))
}
