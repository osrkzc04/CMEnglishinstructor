"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react"

import { Alert } from "@/components/ui/alert"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { reopenTestSession } from "@/modules/tests/sessions/reopen.action"

/**
 * Reabre una evaluación que quedó cerrada (tiempo agotado, browser cerrado,
 * dispositivo bloqueado, etc.). Aparece en el header de
 * `/admin/pruebas/[id]` cuando el estado lo permite.
 *
 * El candidato vuelve a entrar con el mismo enlace del correo. Le enviamos un
 * correo nuevo con la nueva fecha límite. Si la evaluación ya estaba revisada,
 * la revisión queda como referencia interna pero se "deshace" (status vuelve
 * a no-terminal); coordinación debe re-cerrarla.
 */

type Props = {
  sessionId: string
  candidateFirstName: string
  defaultMinutes: number
  status: "TIMED_OUT" | "PENDING_WRITING" | "SUBMITTED" | "REVIEWED"
}

const STATUS_COPY: Record<Props["status"], { line: string }> = {
  TIMED_OUT: { line: "Se le acabó el tiempo." },
  PENDING_WRITING: { line: "Quedó pendiente de enviar la redacción." },
  SUBMITTED: { line: "Ya había sido entregada." },
  REVIEWED: { line: "Ya estaba revisada. Al reabrir, la revisión queda en borrador interno hasta que vuelvas a cerrarla." },
}

export function ReopenButton({
  sessionId,
  candidateFirstName,
  defaultMinutes,
  status,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState(String(defaultMinutes))
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ emailQueued: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  function onConfirm() {
    setServerError(null)
    setSuccess(null)
    startTransition(async () => {
      const parsed = Number(minutes)
      const response = await reopenTestSession({
        sessionId,
        extendMinutes: Number.isFinite(parsed) ? parsed : undefined,
      })
      if (!response.success) {
        setServerError(response.error)
        return
      }
      setSuccess({ emailQueued: response.emailQueued })
      router.refresh()
    })
  }

  function onOpenChange(next: boolean) {
    if (isPending) return
    setOpen(next)
    if (!next) {
      // Reseteamos estado para que la próxima apertura sea limpia.
      setServerError(null)
      setSuccess(null)
      setMinutes(String(defaultMinutes))
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={() => setOpen(true)}
      >
        <RotateCcw size={14} strokeWidth={1.7} />
        Reabrir evaluación
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Reabrir evaluación de {candidateFirstName}</DialogTitle>
            <DialogDescription>
              {STATUS_COPY[status].line} El candidato podrá volver a entrar desde el enlace de su
              correo (le mandaremos uno nuevo). Lo que ya respondió se conserva.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {serverError && (
              <Alert
                variant="danger"
                icon={<AlertTriangle size={16} strokeWidth={1.6} />}
                title="No pudimos reabrir la evaluación"
                description={serverError}
                onDismiss={() => setServerError(null)}
              />
            )}

            {success ? (
              <Alert
                variant="teal"
                icon={<CheckCircle2 size={16} strokeWidth={1.6} />}
                title="Evaluación reabierta"
                description={
                  success.emailQueued
                    ? "Enviamos al candidato un correo con la nueva fecha límite y el enlace para continuar."
                    : "Quedó habilitada. Si el correo no llega, comparte el enlace original con el candidato."
                }
              />
            ) : (
              <>
                <div>
                  <Label htmlFor="reopen-minutes" className="mb-1.5 block">
                    Nueva ventana de tiempo
                  </Label>
                  <div className="relative">
                    <Input
                      id="reopen-minutes"
                      type="number"
                      min={5}
                      max={240}
                      step={1}
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      className="pr-20"
                      disabled={isPending}
                    />
                    <span className="text-text-4 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[11.5px] tracking-[0.06em] uppercase">
                      minutos
                    </span>
                  </div>
                  <p className="text-text-3 mt-1.5 text-[12px] leading-[1.5]">
                    Cuenta desde ahora. Por defecto, el tiempo total que tiene la plantilla.
                  </p>
                </div>

                <div className="border-border bg-surface-alt rounded-md border p-3">
                  <p className="text-text-2 text-[12.5px] leading-[1.5]">
                    Al reabrir también liberamos el bloqueo de dispositivo: el candidato podrá
                    entrar desde otra computadora si la primera quedó inaccesible.
                  </p>
                </div>
              </>
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
              {success ? "Cerrar" : "Cancelar"}
            </Button>
            {!success && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onConfirm}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                    Reabriendo…
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} strokeWidth={1.7} />
                    Reabrir
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
