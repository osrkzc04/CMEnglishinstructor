"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import { AlertTriangle, ArrowUpRight, Loader2, Plus, Trash2 } from "lucide-react"
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
import { addEnrollmentToClassGroup } from "@/modules/classGroups/addEnrollment.action"
import { removeEnrollmentFromClassGroup } from "@/modules/classGroups/removeEnrollment.action"
import type {
  ClassGroupEnrollmentRow,
  EligibleEnrollmentOption,
} from "@/modules/classGroups/queries"

type Props = {
  classGroupId: string
  enrollments: ClassGroupEnrollmentRow[]
  eligibleEnrollments: EligibleEnrollmentOption[]
  canEdit: boolean
}

type ActiveDialog =
  | { kind: "add" }
  | { kind: "remove"; enrollmentId: string; studentName: string }
  | null

export function EnrollmentsCard({
  classGroupId,
  enrollments,
  eligibleEnrollments,
  canEdit,
}: Props) {
  const [dialog, setDialog] = useState<ActiveDialog>(null)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] text-text-3">
          {enrollments.length}{" "}
          {enrollments.length === 1 ? "matrícula" : "matrículas"} en el aula
        </p>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialog({ kind: "add" })}
            disabled={eligibleEnrollments.length === 0}
            title={
              eligibleEnrollments.length === 0
                ? "No hay matrículas elegibles del mismo nivel"
                : undefined
            }
          >
            <Plus size={12} strokeWidth={1.6} />
            Agregar alumno
          </Button>
        )}
      </div>

      {enrollments.length === 0 ? (
        <p className="mt-3 rounded-md border border-border bg-surface-alt px-4 py-6 text-center text-[13px] text-text-3">
          Aula vacía. Sumá alumnos elegibles desde el botón.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {enrollments.map((e) => (
            <li
              key={e.enrollmentId}
              className="flex flex-wrap items-baseline justify-between gap-3 rounded-md border border-border bg-surface-alt px-4 py-3"
            >
              <div>
                <Link
                  href={`/admin/estudiantes/${e.studentId}` as Route}
                  className="text-[14px] text-foreground hover:text-teal-500"
                >
                  {e.studentName}
                </Link>
                <p className="mt-0.5 text-[12.5px] text-text-3">{e.studentEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/estudiantes/${e.studentId}` as Route}
                  className="inline-flex items-center gap-1 text-[12.5px] text-text-3 transition-colors hover:text-teal-500"
                >
                  Ver
                  <ArrowUpRight size={11} strokeWidth={1.6} />
                </Link>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Quitar a ${e.studentName} del aula`}
                    onClick={() =>
                      setDialog({
                        kind: "remove",
                        enrollmentId: e.enrollmentId,
                        studentName: e.studentName,
                      })
                    }
                    className="grid h-7 w-7 place-items-center rounded-md text-text-3 transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={13} strokeWidth={1.6} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === "add" && (
        <AddEnrollmentDialog
          classGroupId={classGroupId}
          options={eligibleEnrollments}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "remove" && (
        <RemoveEnrollmentDialog
          classGroupId={classGroupId}
          enrollmentId={dialog.enrollmentId}
          studentName={dialog.studentName}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
//  Agregar
// -----------------------------------------------------------------------------

function AddEnrollmentDialog({
  classGroupId,
  options,
  onClose,
}: {
  classGroupId: string
  options: EligibleEnrollmentOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!selectedId) return
    setError(null)
    startTransition(async () => {
      const result = await addEnrollmentToClassGroup({
        classGroupId,
        enrollmentId: selectedId,
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
          <DialogTitle>Agregar alumno al aula</DialogTitle>
          <DialogDescription>
            Solo aparecen matrículas activas del mismo nivel que aún no
            pertenecen a otra aula.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {error && (
            <Alert
              variant="danger"
              icon={<AlertTriangle size={16} strokeWidth={1.6} />}
              title="No pudimos agregar"
              description={error}
              onDismiss={() => setError(null)}
            />
          )}
          {options.length === 0 ? (
            <p className="text-[13.5px] text-text-3">
              No hay matrículas elegibles para sumarse a esta aula.
            </p>
          ) : (
            <div className="space-y-1.5">
              {options.map((o) => (
                <button
                  key={o.enrollmentId}
                  type="button"
                  onClick={() => setSelectedId(o.enrollmentId)}
                  className={[
                    "block w-full rounded-md border px-4 py-3 text-left transition-colors",
                    selectedId === o.enrollmentId
                      ? "border-teal-500 bg-teal-500/[0.06]"
                      : "border-border bg-surface hover:border-border-strong",
                  ].join(" ")}
                >
                  <p className="text-[14px] font-medium text-foreground">
                    {o.studentName}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-text-3">
                    {o.studentEmail}
                  </p>
                </button>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedId || isPending}
          >
            {isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Agregando…
              </>
            ) : (
              "Agregar al aula"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// -----------------------------------------------------------------------------
//  Quitar
// -----------------------------------------------------------------------------

function RemoveEnrollmentDialog({
  classGroupId,
  enrollmentId,
  studentName,
  onClose,
}: {
  classGroupId: string
  enrollmentId: string
  studentName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await removeEnrollmentFromClassGroup({
        classGroupId,
        enrollmentId,
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
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Quitar del aula</DialogTitle>
          <DialogDescription>
            <strong>{studentName}</strong> queda como matrícula en espera de
            aula. Las clases futuras todavía planificadas dejan de incluirlo.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {error && (
            <Alert
              variant="danger"
              icon={<AlertTriangle size={16} strokeWidth={1.6} />}
              title="No pudimos quitar"
              description={error}
              onDismiss={() => setError(null)}
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Quitando…
              </>
            ) : (
              "Quitar del aula"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
