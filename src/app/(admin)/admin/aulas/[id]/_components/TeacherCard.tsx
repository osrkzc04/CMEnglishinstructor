"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, RotateCw, UserPlus } from "lucide-react"
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
import { Tag } from "@/components/ui/tag"
import { setClassGroupTeacher } from "@/modules/classGroups/setTeacher.action"
import {
  candidateIsEligible,
  type TeacherCandidate,
} from "@/modules/classGroups/eligibility-shared"
import type { ClassGroupTeacherAssignmentRow } from "@/modules/classGroups/queries"

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

type Props = {
  classGroupId: string
  currentAssignment: ClassGroupTeacherAssignmentRow | null
  pastAssignments: ClassGroupTeacherAssignmentRow[]
  candidates: TeacherCandidate[]
  canEdit: boolean
}

export function TeacherCard({
  classGroupId,
  currentAssignment,
  pastAssignments,
  candidates,
  canEdit,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div>
      {currentAssignment ? (
        <div className="border-border bg-surface-alt flex flex-wrap items-baseline justify-between gap-3 rounded-md border px-4 py-3">
          <div>
            <p className="text-foreground text-[14px]">{currentAssignment.teacherName}</p>
            <p className="text-text-3 mt-0.5 text-[12px]">
              Desde {formatDate(currentAssignment.startDate)}
            </p>
          </div>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
              <RotateCw size={12} strokeWidth={1.6} />
              Rotar docente
            </Button>
          )}
        </div>
      ) : (
        <div className="border-warning/40 bg-warning/[0.06] flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
          <p className="text-warning text-[13px]">
            Sin docente asignado. El aula no genera clases hasta que tenga uno.
          </p>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
              <UserPlus size={12} strokeWidth={1.6} />
              Asignar docente
            </Button>
          )}
        </div>
      )}

      {pastAssignments.length > 0 && (
        <div className="mt-4">
          <p className="text-text-3 mb-2 font-mono text-[11px] tracking-[0.08em] uppercase">
            Histórico
          </p>
          <ul className="space-y-1.5">
            {pastAssignments.map((a) => (
              <li
                key={a.id}
                className="border-border flex flex-wrap items-baseline justify-between gap-3 border-b pb-2 text-[13px] last:border-b-0 last:pb-0"
              >
                <span className="text-foreground">{a.teacherName}</span>
                <span className="text-text-3 font-mono text-[12px] tracking-[0.02em]">
                  {formatDate(a.startDate)}
                  {" — "}
                  {a.endDate ? formatDate(a.endDate) : "vigente"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dialogOpen && (
        <SetTeacherDialog
          classGroupId={classGroupId}
          candidates={candidates}
          excludeTeacherId={currentAssignment?.teacherId ?? null}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
//  Diálogo de asignación
// -----------------------------------------------------------------------------

function SetTeacherDialog({
  classGroupId,
  candidates,
  excludeTeacherId,
  onClose,
}: {
  classGroupId: string
  candidates: TeacherCandidate[]
  excludeTeacherId: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = candidates.filter((c) => c.id !== excludeTeacherId)
  const eligible = filtered.filter(candidateIsEligible)
  const notEligible = filtered.filter((c) => !candidateIsEligible(c))

  function handleSubmit() {
    if (!selectedId) return
    setError(null)
    startTransition(async () => {
      const result = await setClassGroupTeacher({
        classGroupId,
        teacherId: selectedId,
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
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Asignar docente al aula</DialogTitle>
          <DialogDescription>
            Los docentes elegibles cubren el nivel CEFR, tienen disponibilidad para todos los
            horarios del aula y no chocan con otra aula simultánea.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {error && (
            <Alert
              variant="danger"
              icon={<AlertTriangle size={16} strokeWidth={1.6} />}
              title="No pudimos asignar"
              description={error}
              onDismiss={() => setError(null)}
            />
          )}

          {filtered.length === 0 ? (
            <p className="text-text-3 text-[13.5px]">No hay docentes para mostrar.</p>
          ) : (
            <>
              {eligible.length > 0 && (
                <div>
                  <p className="text-text-3 mb-2 font-mono text-[11px] tracking-[0.08em] uppercase">
                    Elegibles ({eligible.length})
                  </p>
                  <div className="space-y-1.5">
                    {eligible.map((c) => (
                      <CandidateRow
                        key={c.id}
                        candidate={c}
                        selected={selectedId === c.id}
                        onSelect={() => setSelectedId(c.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {notEligible.length > 0 && (
                <div>
                  <p className="text-text-3 mb-2 font-mono text-[11px] tracking-[0.08em] uppercase">
                    Con conflictos ({notEligible.length})
                  </p>
                  <div className="space-y-1.5">
                    {notEligible.map((c) => (
                      <CandidateRow
                        key={c.id}
                        candidate={c}
                        selected={false}
                        onSelect={() => {}}
                        disabled
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!selectedId || isPending}>
            {isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
                Asignando…
              </>
            ) : (
              "Confirmar asignación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CandidateRow({
  candidate,
  selected,
  onSelect,
  disabled,
}: {
  candidate: TeacherCandidate
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  const reasons: string[] = []
  if (candidate.conflicts.cefrMismatch) reasons.push("No cubre el CEFR del aula")
  if (candidate.conflicts.uncoveredSlots.length > 0) {
    const slotLabels = candidate.conflicts.uncoveredSlots
      .map((s) => `${DAYS_SHORT[s.dayOfWeek]} ${s.startTime}`)
      .join(", ")
    reasons.push(`Sin disponibilidad para: ${slotLabels}`)
  }
  if (candidate.conflicts.doubleBookedSlots.length > 0) {
    const groupNames = [
      ...new Set(candidate.conflicts.doubleBookedSlots.map((d) => d.classGroupName)),
    ]
    reasons.push(`Choca con: ${groupNames.join(", ")}`)
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={[
        "block w-full rounded-md border px-4 py-3 text-left transition-colors",
        selected
          ? "border-teal-500 bg-teal-500/[0.06]"
          : disabled
            ? "border-border bg-surface-alt opacity-70"
            : "border-border bg-surface hover:border-border-strong",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-foreground text-[14px] font-medium">
            {candidate.firstName} {candidate.lastName}
          </p>
          <p className="text-text-3 mt-0.5 text-[12px]">{candidate.email}</p>
        </div>
        {!disabled && <Tag>${candidate.hourlyRate}/hora</Tag>}
      </div>
      {reasons.length > 0 && (
        <ul className="text-warning mt-2 space-y-0.5 text-[12px]">
          {reasons.map((r, i) => (
            <li key={i}>• {r}</li>
          ))}
        </ul>
      )}
    </button>
  )
}

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Guayaquil",
})

function formatDate(d: Date): string {
  return dateFormatter.format(d).replace(/\./g, "")
}
