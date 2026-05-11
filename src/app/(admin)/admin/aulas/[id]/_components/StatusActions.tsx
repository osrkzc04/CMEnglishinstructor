"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle, Loader2, X } from "lucide-react"
import { ClassGroupStatus } from "@prisma/client"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { setClassGroupStatus } from "@/modules/classGroups/setStatus.action"

type Props = {
  classGroupId: string
  status: ClassGroupStatus
}

type ActiveDialog = "complete" | "cancel" | null

export function StatusActions({ classGroupId, status }: Props) {
  const [dialog, setDialog] = useState<ActiveDialog>(null)

  if (status !== ClassGroupStatus.ACTIVE) {
    return (
      <section className="border-border bg-surface rounded-xl border p-5 lg:p-6">
        <h2 className="text-foreground mb-2 font-serif text-[18px] font-normal tracking-[-0.01em]">
          Estado
        </h2>
        <p className="text-text-3 text-[13px]">
          {status === ClassGroupStatus.COMPLETED
            ? "Aula cerrada — los datos quedan como histórico."
            : "Aula cancelada — las matrículas fueron liberadas."}
        </p>
      </section>
    )
  }

  return (
    <section className="border-border bg-surface rounded-xl border p-5 lg:p-6">
      <h2 className="text-foreground mb-4 font-serif text-[18px] font-normal tracking-[-0.01em]">
        Acciones del aula
      </h2>
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="md"
          onClick={() => setDialog("complete")}
          className="justify-start"
        >
          <CheckCircle size={14} strokeWidth={1.6} />
          Marcar como cerrada
        </Button>
        <Button
          variant="danger"
          size="md"
          onClick={() => setDialog("cancel")}
          className="justify-start"
        >
          <X size={14} strokeWidth={1.8} />
          Cancelar aula
        </Button>
      </div>

      {dialog === "complete" && (
        <ConfirmStatusDialog
          classGroupId={classGroupId}
          target={ClassGroupStatus.COMPLETED}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "cancel" && (
        <ConfirmStatusDialog
          classGroupId={classGroupId}
          target={ClassGroupStatus.CANCELLED}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  )
}

function ConfirmStatusDialog({
  classGroupId,
  target,
  onClose,
}: {
  classGroupId: string
  target: typeof ClassGroupStatus.COMPLETED | typeof ClassGroupStatus.CANCELLED
  onClose: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isCancel = target === ClassGroupStatus.CANCELLED

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await setClassGroupStatus(classGroupId, { status: target })
      if (!result.success) {
        setError(result.error)
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{isCancel ? "Cancelar aula" : "Cerrar aula"}</DialogTitle>
          <DialogDescription>
            {isCancel
              ? "Las matrículas quedan en espera de aula. Los datos históricos (clases dictadas, asistencia) se preservan."
              : "El docente cierra su asignación. La aula deja de aparecer como activa pero queda consultable."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {error && (
            <Alert
              variant="danger"
              icon={<AlertTriangle size={16} strokeWidth={1.6} />}
              title="No pudimos cambiar el estado"
              description={error}
              onDismiss={() => setError(null)}
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Volver
          </Button>
          <Button
            variant={isCancel ? "danger" : "primary"}
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Procesando…
              </>
            ) : isCancel ? (
              "Confirmar cancelación"
            ) : (
              "Confirmar cierre"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
