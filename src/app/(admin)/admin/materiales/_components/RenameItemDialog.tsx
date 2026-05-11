"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { renameFolder } from "@/modules/materials/renameFolder.action"
import { renameFile } from "@/modules/materials/renameFile.action"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemKind: "folder" | "file"
  id: string
  currentName: string
  onRenamed: () => void
}

export function RenameItemDialog({
  open,
  onOpenChange,
  itemKind,
  id,
  currentName,
  onRenamed,
}: Props) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setName(currentName)
      setError(null)
    }
  }, [open, currentName])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name === currentName) {
      onOpenChange(false)
      return
    }
    setError(null)
    startTransition(async () => {
      const result =
        itemKind === "folder"
          ? await renameFolder({ folderId: id, name })
          : await renameFile({ fileId: id, name })
      if (!result.success) {
        setError(result.error)
        return
      }
      onRenamed()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            Renombrar {itemKind === "folder" ? "carpeta" : "archivo"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-1.5">
              <Label htmlFor="rename-name">Nombre</Label>
              <Input
                id="rename-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={isPending}
              />
            </div>
            {error && (
              <Alert variant="danger" className="mt-3">
                {error}
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
            <Button type="submit" variant="primary" size="md" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
