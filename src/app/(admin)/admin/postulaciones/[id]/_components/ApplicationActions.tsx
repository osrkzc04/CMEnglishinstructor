"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react"
import { ApplicationStatus } from "@prisma/client"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { approveApplication } from "@/modules/teachers/applications/approve.action"
import { rejectApplication } from "@/modules/teachers/applications/reject.action"
import { deleteApplication } from "@/modules/teachers/applications/delete.action"

/**
 * Panel lateral con las acciones disponibles según el estado de la
 * postulación. Cada acción de impacto (aprobar / rechazar / eliminar) abre
 * un dialog de confirmación; editar redirige al listado con el dialog de
 * edición ya existente abierto.
 */

type Props = {
  applicationId: string
  status: ApplicationStatus
  applicantName: string
  /** Si la postulación está APPROVED, el id del User docente creado. */
  teacherUserId: string | null
}

type ActiveDialog = "approve" | "reject" | "delete" | null

export function ApplicationActions({
  applicationId,
  status,
  applicantName,
}: Props) {
  const router = useRouter()
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const close = () => setActiveDialog(null)

  function handleEdit() {
    // El dialog de edición vive en la página de listado. Reusamos esa ruta
    // para no duplicar form. Al cerrar el dialog ahí se limpia el query
    // string y queda en el listado.
    router.push(
      `/admin/postulaciones?action=edit&id=${applicationId}` as Route,
    )
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 lg:p-6">
      <h2 className="mb-4 font-serif text-[18px] font-normal tracking-[-0.01em] text-foreground">
        Acciones
      </h2>

      <div className="flex flex-col gap-2">
        {status === ApplicationStatus.PENDING && (
          <>
            <Button
              variant="primary"
              size="md"
              onClick={() => setActiveDialog("approve")}
              className="justify-start"
            >
              <Check size={14} strokeWidth={1.8} />
              Aprobar postulación
            </Button>

            <Button
              variant="ghost"
              size="md"
              onClick={handleEdit}
              className="justify-start"
            >
              <Pencil size={14} strokeWidth={1.6} />
              Editar datos
            </Button>

            <Button
              variant="ghost"
              size="md"
              onClick={() => setActiveDialog("reject")}
              className="justify-start"
            >
              <X size={14} strokeWidth={1.8} />
              Rechazar
            </Button>
          </>
        )}

        <Button
          variant="danger"
          size="md"
          onClick={() => setActiveDialog("delete")}
          className="justify-start"
        >
          <Trash2 size={14} strokeWidth={1.6} />
          Eliminar postulación
        </Button>
      </div>

      {activeDialog === "approve" && (
        <ApproveDialog
          applicationId={applicationId}
          applicantName={applicantName}
          onClose={close}
        />
      )}
      {activeDialog === "reject" && (
        <RejectDialog
          applicationId={applicationId}
          applicantName={applicantName}
          onClose={close}
        />
      )}
      {activeDialog === "delete" && (
        <DeleteDialog
          applicationId={applicationId}
          applicantName={applicantName}
          onClose={close}
        />
      )}
    </section>
  )
}

// -----------------------------------------------------------------------------
//  Aprobar
// -----------------------------------------------------------------------------

function ApproveDialog({
  applicationId,
  applicantName,
  onClose,
}: {
  applicationId: string
  applicantName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await approveApplication(applicationId)
      if (!result.success) {
        setError(result.error)
        return
      }
      onClose()
      router.push(`/admin/docentes/${result.teacherId}` as Route)
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Aprobar postulación</DialogTitle>
          <DialogDescription>
            Se va a crear el perfil de docente para <strong>{applicantName}</strong> y
            se enviará un correo con el enlace para que defina su contraseña.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {error && (
            <Alert
              variant="danger"
              icon={<AlertTriangle size={16} strokeWidth={1.6} />}
              title="No pudimos aprobar la postulación"
              description={error}
              onDismiss={() => setError(null)}
            />
          )}
          <p className="text-[13.5px] leading-[1.6] text-text-2">
            Los niveles y la disponibilidad propuesta se copian al perfil del
            docente, listos para asignación.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Aprobando…
              </>
            ) : (
              "Confirmar y aprobar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// -----------------------------------------------------------------------------
//  Rechazar
// -----------------------------------------------------------------------------

function RejectDialog({
  applicationId,
  applicantName,
  onClose,
}: {
  applicationId: string
  applicantName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await rejectApplication(applicationId, {
        rejectionReason: reason,
      })
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
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Rechazar postulación</DialogTitle>
          <DialogDescription>
            El motivo queda registrado en el sistema. Por ahora no se envía
            notificación a {applicantName}.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {error && (
            <Alert
              variant="danger"
              icon={<AlertTriangle size={16} strokeWidth={1.6} />}
              title="No pudimos registrar el rechazo"
              description={error}
              onDismiss={() => setError(null)}
            />
          )}
          <div>
            <Label htmlFor="rejectionReason" className="mb-1.5 block">
              Motivo
            </Label>
            <Textarea
              id="rejectionReason"
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mínimo 10 caracteres. Esta nota es solo para uso interno."
            />
            <p className="mt-1.5 text-[12px] text-text-4">
              {reason.trim().length} de 10 mínimo
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            disabled={isPending || reason.trim().length < 10}
          >
            {isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Rechazando…
              </>
            ) : (
              "Rechazar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// -----------------------------------------------------------------------------
//  Eliminar
// -----------------------------------------------------------------------------

function DeleteDialog({
  applicationId,
  applicantName,
  onClose,
}: {
  applicationId: string
  applicantName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await deleteApplication(applicationId)
      if (!result.success) {
        setError(result.error)
        return
      }
      onClose()
      router.push("/admin/postulaciones" as Route)
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Eliminar postulación</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Se borra el registro de{" "}
            <strong>{applicantName}</strong> junto con sus niveles y
            disponibilidad.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {error && (
            <Alert
              variant="danger"
              icon={<AlertTriangle size={16} strokeWidth={1.6} />}
              title="No pudimos eliminar"
              description={error}
              onDismiss={() => setError(null)}
            />
          )}
          <p className="text-[13.5px] leading-[1.6] text-text-2">
            Si esta postulación ya fue aprobada, el perfil del docente
            permanece — solo se elimina el rastro de la postulación.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Eliminando…
              </>
            ) : (
              "Eliminar definitivamente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
