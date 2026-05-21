"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import { Eye, EyeOff, Loader2, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { setQuestionActive } from "@/modules/questions/setActive.action"

/**
 * Acciones por fila del banco — Editar (link) y Activar/Desactivar (action
 * con confirmación).
 *
 * Vive en client component para soportar el Dialog. La tabla padre puede
 * permanecer server.
 */

export function QuestionRowActions({
  questionId,
  levelCode,
  prompt,
  isActive,
  hasBeenUsed,
}: {
  questionId: string
  levelCode: string
  prompt: string
  isActive: boolean
  hasBeenUsed: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const editHref = `/admin/preguntas/${levelCode.toLowerCase()}/${questionId}/editar` as Route

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await setQuestionActive({ id: questionId, isActive: !isActive })
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  const truncatedPrompt = prompt.length > 90 ? `${prompt.slice(0, 90)}…` : prompt

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={editHref}
        aria-label="Editar pregunta"
        title="Editar pregunta"
        className="border-border bg-surface text-text-2 inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors hover:border-teal-500 hover:text-teal-500"
      >
        <Pencil size={12} strokeWidth={1.7} />
      </Link>
      <button
        type="button"
        aria-label={isActive ? "Desactivar pregunta" : "Reactivar pregunta"}
        title={isActive ? "Desactivar pregunta" : "Reactivar pregunta"}
        onClick={() => setOpen(true)}
        className="border-border bg-surface text-text-2 hover:border-danger hover:text-danger inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors"
      >
        {isActive ? <EyeOff size={12} strokeWidth={1.7} /> : <Eye size={12} strokeWidth={1.7} />}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{isActive ? "Desactivar pregunta" : "Reactivar pregunta"}</DialogTitle>
            <DialogDescription>
              {isActive
                ? "La pregunta deja de aparecer en el sorteo del placement test. Los intentos ya rendidos no se modifican."
                : "La pregunta vuelve al sorteo del placement test."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="border-border bg-surface-alt rounded-md border px-3 py-2.5">
              <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
                Pregunta
              </p>
              <p className="text-foreground mt-1 text-[13.5px] leading-[1.5]">{truncatedPrompt}</p>
            </div>
            {isActive && hasBeenUsed && (
              <p className="text-text-3 mt-3 text-[12.5px] leading-[1.5]">
                Esta pregunta ya se usó en evaluaciones — esos snapshots quedan intactos. Solo
                desaparece de los sorteos futuros.
              </p>
            )}
            {error && <p className="text-danger mt-3 text-[13px]">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={isActive ? "primary" : "primary"}
              size="md"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                  Guardando…
                </>
              ) : isActive ? (
                "Sí, desactivar"
              ) : (
                "Sí, reactivar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
