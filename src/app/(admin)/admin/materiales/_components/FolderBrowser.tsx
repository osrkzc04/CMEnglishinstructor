"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import {
  Download,
  FilePlus,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { FileTypeIcon } from "@/components/materials/FileTypeIcon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FolderDetail, FolderItem } from "@/modules/materials/queries"
import { NewFolderDialog } from "./NewFolderDialog"
import { RenameItemDialog } from "./RenameItemDialog"
import { DeleteItemDialog } from "./DeleteItemDialog"
import { UploadButton } from "./UploadButton"

type Props = {
  folder: FolderDetail
}

type ActionState =
  | { kind: "rename"; itemKind: "folder" | "file"; id: string; name: string }
  | { kind: "delete"; itemKind: "folder" | "file"; id: string; name: string }
  | { kind: "newFolder" }
  | null

export function FolderBrowser({ folder }: Props) {
  const router = useRouter()
  const [action, setAction] = useState<ActionState>(null)

  function refresh() {
    router.refresh()
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="md" onClick={() => setAction({ kind: "newFolder" })}>
          <FolderPlus size={14} strokeWidth={1.6} />
          Nueva carpeta
        </Button>
        <UploadButton folderId={folder.id} onComplete={refresh} />
        <div className="text-text-3 ml-auto text-[12.5px]">
          {folder.items.length} {folder.items.length === 1 ? "elemento" : "elementos"}
        </div>
      </div>

      {folder.items.length === 0 ? (
        <EmptyState
          icon={FilePlus}
          title="Carpeta vacía"
          description="Subí archivos o creá subcarpetas para organizar el material."
        />
      ) : (
        <div className="border-border bg-surface overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-[120px]">Tamaño</TableHead>
                <TableHead className="w-[160px]">Modificado</TableHead>
                <TableHead className="w-[100px] text-right">Acciones</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {folder.items.map((item) => (
                <ItemRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  onRename={() =>
                    setAction({ kind: "rename", itemKind: item.kind, id: item.id, name: item.name })
                  }
                  onDelete={() =>
                    setAction({ kind: "delete", itemKind: item.kind, id: item.id, name: item.name })
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewFolderDialog
        open={action?.kind === "newFolder"}
        onOpenChange={(open) => !open && setAction(null)}
        parentId={folder.id}
        onCreated={() => {
          setAction(null)
          refresh()
        }}
      />

      {action?.kind === "rename" && (
        <RenameItemDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          itemKind={action.itemKind}
          id={action.id}
          currentName={action.name}
          onRenamed={() => {
            setAction(null)
            refresh()
          }}
        />
      )}

      {action?.kind === "delete" && (
        <DeleteItemDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          itemKind={action.itemKind}
          id={action.id}
          name={action.name}
          onDeleted={() => {
            setAction(null)
            refresh()
          }}
        />
      )}
    </>
  )
}

function ItemRow({
  item,
  onRename,
  onDelete,
}: {
  item: FolderItem
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <TableRow>
      <TableCell>
        {item.kind === "folder" ? (
          <Link
            href={`/admin/materiales/${item.id}` as Route}
            className="group text-foreground inline-flex items-center gap-2.5"
          >
            <Folder size={15} strokeWidth={1.6} className="text-text-3 group-hover:text-teal-500" />
            <span className="font-medium group-hover:text-teal-500">{item.name}</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2.5">
            <FileTypeIcon
              name={item.name}
              mimeType={item.mimeType}
              size={15}
              strokeWidth={1.6}
              className="text-text-3"
            />
            <span className="text-foreground">{item.name}</span>
          </span>
        )}
      </TableCell>
      <TableCell className="text-text-3 font-mono text-[12.5px]">
        {item.kind === "file" ? formatBytes(item.size) : "—"}
      </TableCell>
      <TableCell className="text-text-3 text-[12.5px]">
        {formatDate(item.kind === "file" ? item.uploadedAt : item.updatedAt)}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-1">
          {item.kind === "file" && (
            <a
              href={`/api/materials/files/${item.id}/download`}
              className="border-border bg-surface text-text-2 inline-flex items-center justify-center rounded-md border p-1.5 transition-colors hover:border-teal-500 hover:text-teal-500"
              aria-label={`Descargar ${item.name}`}
              download
            >
              <Download size={13} strokeWidth={1.6} />
            </a>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={`Acciones para ${item.name}`}
                className="border-border bg-surface text-text-2 inline-flex items-center justify-center rounded-md border p-1.5 transition-colors hover:border-teal-500 hover:text-teal-500"
              >
                <MoreHorizontal size={13} strokeWidth={1.6} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="border-border bg-surface z-50 min-w-[160px] rounded-md border py-1 shadow-md"
              >
                <DropdownMenu.Item
                  onSelect={onRename}
                  className="text-text-2 hover:bg-bone-100 hover:text-foreground flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors outline-none"
                >
                  <Pencil size={12} strokeWidth={1.6} />
                  Renombrar
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={onDelete}
                  className="text-danger hover:bg-bone-100 flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors outline-none"
                >
                  <Trash2 size={12} strokeWidth={1.6} />
                  Eliminar
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </TableCell>
    </TableRow>
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
