"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { deleteFolder } from "@/modules/materials/deleteFolder.action"
import { deleteFile } from "@/modules/materials/deleteFile.action"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemKind: "folder" | "file"
  id: string
  name: string
  onDeleted: () => void
}

export function DeleteItemDialog({
  open,
  onOpenChange,
  itemKind,
  id,
  name,
  onDeleted,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result =
        itemKind === "folder"
          ? await deleteFolder({ folderId: id })
          : await deleteFile({ fileId: id })
      if (!result.success) {
        setError(result.error)
        return
      }
      onDeleted()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            Eliminar {itemKind === "folder" ? "carpeta" : "archivo"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-[13.5px] text-text-2">
            Vas a eliminar{" "}
            <span className="font-medium text-foreground">{name}</span>
            {itemKind === "folder"
              ? " y todo lo que contenga (subcarpetas y archivos). Esta acción no se puede deshacer."
              : ". Esta acción no se puede deshacer."}
          </p>
          {error && (
            <Alert variant="danger" className="mt-3">
              {error}
            </Alert>
          )}
          {!error && itemKind === "folder" && (
            <Alert variant="warn" className="mt-3">
              <AlertTriangle size={14} strokeWidth={1.6} className="text-warning" />
              Si tiene archivos pesados, también se borran del disco.
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
