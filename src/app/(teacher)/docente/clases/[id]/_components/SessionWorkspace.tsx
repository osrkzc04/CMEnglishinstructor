"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Video,
  XCircle,
} from "lucide-react"
import { AttendanceStatus, SessionStatus } from "@prisma/client"
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
import { Tag } from "@/components/ui/tag"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { ClassSessionDetail } from "@/modules/classes/queries"
import { updateAttendance } from "@/modules/classes/updateAttendance.action"
import { upsertClassLog } from "@/modules/classes/upsertClassLog.action"
import { closeClassSession } from "@/modules/classes/closeClassSession.action"
import { cancelClassSession } from "@/modules/classes/cancelClassSession.action"
import { EditMeetingDialog } from "./EditMeetingDialog"

const MODALITY_LABEL: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrida",
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  SCHEDULED: "Programada",
  COMPLETED: "Cerrada",
  CANCELLED: "Cancelada",
  NO_SHOW: "Sin asistencia",
}

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: AttendanceStatus.PENDING, label: "—" },
  { value: AttendanceStatus.PRESENT, label: "Presente" },
  { value: AttendanceStatus.LATE, label: "Tarde" },
  { value: AttendanceStatus.ABSENT, label: "Ausente" },
  { value: AttendanceStatus.EXCUSED, label: "Justificado" },
]

type Props = {
  detail: ClassSessionDetail
}

export function SessionWorkspace({ detail }: Props) {
  const router = useRouter()
  const isClosed = detail.status === SessionStatus.COMPLETED
  const isCancelled = detail.status === SessionStatus.CANCELLED
  const isReadOnly = isClosed || isCancelled

  const [participants, setParticipants] = useState(detail.participants)
  const [participantSavingId, setParticipantSavingId] = useState<string | null>(null)
  const [participantError, setParticipantError] = useState<string | null>(null)

  const [topic, setTopic] = useState(detail.log?.topic ?? "")
  const [activities, setActivities] = useState(detail.log?.activities ?? "")
  const [homework, setHomework] = useState(detail.log?.homework ?? "")
  const [materialsUsed, setMaterialsUsed] = useState(detail.log?.materialsUsed ?? "")
  const [logSaving, startLogSaving] = useTransition()
  const [logSavedAt, setLogSavedAt] = useState<Date | null>(detail.log ? new Date() : null)
  const [logError, setLogError] = useState<string | null>(null)

  const [closeError, setCloseError] = useState<string | null>(null)
  const [closeBusy, startClose] = useTransition()

  const [cancelOpen, setCancelOpen] = useState(false)
  const [meetingOpen, setMeetingOpen] = useState(false)

  function pushAttendance(
    participantId: string,
    partial: Partial<{ status: AttendanceStatus; notes: string }>,
  ) {
    const target = participants.find((p) => p.id === participantId)
    if (!target) return
    const merged = {
      ...target,
      ...(partial.status !== undefined ? { attendance: partial.status } : {}),
      ...(partial.notes !== undefined ? { notes: partial.notes } : {}),
    }
    setParticipants((curr) => curr.map((p) => (p.id === participantId ? merged : p)))
    setParticipantSavingId(participantId)
    setParticipantError(null)

    void updateAttendance({
      sessionId: detail.id,
      updates: [
        {
          participantId,
          status: merged.attendance,
          notes: merged.notes ?? undefined,
        },
      ],
    }).then((result) => {
      setParticipantSavingId(null)
      if (!result.success) {
        setParticipantError(result.error)
      }
    })
  }

  function saveLog() {
    setLogError(null)
    startLogSaving(async () => {
      const result = await upsertClassLog({
        sessionId: detail.id,
        topic,
        activities,
        homework: homework.trim() ? homework : undefined,
        materialsUsed: materialsUsed.trim() ? materialsUsed : undefined,
      })
      if (!result.success) {
        setLogError(result.error)
        return
      }
      setLogSavedAt(new Date())
      router.refresh()
    })
  }

  function handleClose() {
    setCloseError(null)
    startClose(async () => {
      const result = await closeClassSession({ sessionId: detail.id })
      if (!result.success) {
        setCloseError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <Header
        detail={detail}
        canEditMeeting={!isReadOnly}
        onEditMeeting={() => setMeetingOpen(true)}
      />

      {isCancelled && (
        <Alert variant="warn" className="mb-5">
          <span>
            <strong>Cancelada</strong>
            {detail.cancelReason && <> — {detail.cancelReason}</>}
          </span>
        </Alert>
      )}

      {isClosed && (
        <Alert variant="teal" className="mb-5">
          <span>
            <strong>Clase cerrada.</strong> La asistencia y la bitácora están congeladas.
          </span>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card
          title="Asistencia"
          subtitle={`${participants.length} ${participants.length === 1 ? "alumno" : "alumnos"}`}
        >
          {participantError && (
            <Alert variant="danger" className="mb-3">
              {participantError}
            </Alert>
          )}
          <ul className="divide-border divide-y">
            {participants.map((p) => (
              <li key={p.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_180px]">
                <div>
                  <p className="text-foreground text-[14px] font-medium">{p.studentName}</p>
                  {p.noticedAbsenceAt && (
                    <AbsenceNotice
                      noticedAt={p.noticedAbsenceAt}
                      scheduledStart={detail.scheduledStart}
                      note={p.absenceNote}
                    />
                  )}
                  {!isReadOnly && (
                    <input
                      type="text"
                      placeholder="Nota interna (opcional)"
                      defaultValue={p.notes ?? ""}
                      onBlur={(e) => {
                        const value = e.target.value
                        if ((p.notes ?? "") === value) return
                        pushAttendance(p.id, { notes: value })
                      }}
                      className="border-border bg-surface text-foreground hover:border-border-strong mt-1.5 block w-full rounded-md border px-3 py-1.5 text-[12.5px] transition-colors focus:border-teal-500 focus:outline-none"
                    />
                  )}
                  {isReadOnly && p.notes && (
                    <p className="text-text-3 mt-1 text-[12px]">{p.notes}</p>
                  )}
                </div>
                <div className="sm:justify-self-end">
                  {isReadOnly ? (
                    <span className="text-text-2 font-mono text-[12.5px]">
                      {ATTENDANCE_OPTIONS.find((o) => o.value === p.attendance)?.label ?? "—"}
                    </span>
                  ) : (
                    <select
                      value={p.attendance}
                      onChange={(e) =>
                        pushAttendance(p.id, {
                          status: e.target.value as AttendanceStatus,
                        })
                      }
                      disabled={participantSavingId === p.id}
                      className={cn(
                        "bg-surface text-foreground block w-full rounded-md border px-3 py-2 text-[13.5px]",
                        "hover:border-border-strong transition-colors focus:border-teal-500 focus:outline-none",
                        attendanceBorderClass(p.attendance),
                      )}
                    >
                      {ATTENDANCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Bitácora" subtitle="Tema, actividades y tareas">
          {isReadOnly && detail.log ? (
            <ReadOnlyLog log={detail.log} />
          ) : (
            <>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="topic">Tema</Label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ej. Past simple — questions"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="activities">Actividades</Label>
                  <Textarea
                    id="activities"
                    rows={4}
                    value={activities}
                    onChange={(e) => setActivities(e.target.value)}
                    placeholder="Lo que se hizo en clase, páginas trabajadas, ejercicios."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="homework">Tarea (opcional)</Label>
                  <Textarea
                    id="homework"
                    rows={2}
                    value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="materialsUsed">Materiales (opcional)</Label>
                  <Textarea
                    id="materialsUsed"
                    rows={2}
                    value={materialsUsed}
                    onChange={(e) => setMaterialsUsed(e.target.value)}
                  />
                </div>
              </div>

              {logError && (
                <Alert variant="danger" className="mt-3">
                  {logError}
                </Alert>
              )}

              <div className="mt-3 flex items-center justify-end gap-2">
                {logSavedAt && !logError && (
                  <span className="text-text-3 inline-flex items-center gap-1 text-[12px]">
                    <Check size={12} strokeWidth={1.6} className="text-teal-500" />
                    Guardado
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={saveLog}
                  disabled={logSaving}
                >
                  {logSaving && <Loader2 size={13} strokeWidth={1.6} className="animate-spin" />}
                  Guardar bitácora
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {!isReadOnly && (
        <div className="border-border mt-6 flex flex-wrap items-center justify-end gap-3 border-t pt-5">
          {closeError && (
            <Alert variant="danger" className="w-full">
              {closeError}
            </Alert>
          )}
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => setCancelOpen(true)}
            disabled={closeBusy}
          >
            <XCircle size={14} strokeWidth={1.6} />
            Cancelar clase
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleClose}
            disabled={closeBusy}
          >
            {closeBusy ? (
              <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />
            ) : (
              <Lock size={14} strokeWidth={1.6} />
            )}
            Cerrar clase
          </Button>
        </div>
      )}

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        sessionId={detail.id}
        scheduledStart={detail.scheduledStart}
      />

      <EditMeetingDialog
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        classGroupId={detail.classGroupId}
        modality={detail.modality}
        currentMeetingUrl={detail.meetingUrl}
        currentLocation={detail.location}
      />
    </>
  )
}

// -----------------------------------------------------------------------------
//  Sub-componentes
// -----------------------------------------------------------------------------

function Header({
  detail,
  canEditMeeting,
  onEditMeeting,
}: {
  detail: ClassSessionDetail
  canEditMeeting: boolean
  onEditMeeting: () => void
}) {
  const dateLabel = formatGuayaquilDateLabel(detail.scheduledStart)
  const timeLabel = formatGuayaquilTimeRange(detail.scheduledStart, detail.scheduledEnd)
  const isVirtualOrHybrid = detail.modality === "VIRTUAL" || detail.modality === "HIBRIDO"
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          {detail.programLabel}
        </p>
        <h1 className="font-serif text-[28px] leading-[1.18] font-normal tracking-[-0.02em]">
          {detail.classGroupName}
        </h1>
        <div className="text-text-3 mt-2 flex flex-wrap items-baseline gap-3 text-[13.5px]">
          <span>{dateLabel}</span>
          <span aria-hidden>·</span>
          <span className="font-mono">{timeLabel}</span>
          <Tag>{MODALITY_LABEL[detail.modality] ?? detail.modality}</Tag>
          {detail.meetingUrl ? (
            <span className="inline-flex items-center gap-2">
              <a
                href={detail.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700"
              >
                <Video size={12} strokeWidth={1.6} />
                Conectar
                <ExternalLink size={11} strokeWidth={1.6} />
              </a>
              {canEditMeeting && (
                <button
                  type="button"
                  onClick={onEditMeeting}
                  className="text-text-3 hover:text-foreground inline-flex items-center gap-1 transition-colors"
                  aria-label="Editar link de la clase"
                >
                  <Pencil size={11} strokeWidth={1.6} />
                  Editar
                </button>
              )}
            </span>
          ) : (
            isVirtualOrHybrid &&
            canEditMeeting && (
              <button
                type="button"
                onClick={onEditMeeting}
                className="border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors"
              >
                <Plus size={11} strokeWidth={1.6} />
                Cargar link de la clase
              </button>
            )
          )}
          {detail.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} strokeWidth={1.6} />
              {detail.location}
            </span>
          )}
        </div>
      </div>
      <span className="text-text-3 font-mono text-[12px] tracking-[0.08em] uppercase">
        {STATUS_LABEL[detail.status]}
      </span>
    </header>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border bg-surface rounded-xl border px-5 py-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-foreground font-serif text-[18px] font-normal">{title}</h2>
        {subtitle && <span className="text-text-3 text-[12.5px]">{subtitle}</span>}
      </header>
      {children}
    </section>
  )
}

function ReadOnlyLog({ log }: { log: NonNullable<ClassSessionDetail["log"]> }) {
  return (
    <dl className="space-y-3 text-[13.5px]">
      <Field label="Tema">{log.topic}</Field>
      <Field label="Actividades">{log.activities}</Field>
      {log.homework && <Field label="Tarea">{log.homework}</Field>}
      {log.materialsUsed && <Field label="Materiales">{log.materialsUsed}</Field>}
    </dl>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-text-3 mb-0.5 font-mono text-[11px] tracking-[0.08em] uppercase">
        {label}
      </dt>
      <dd className="text-text-2 whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

function CancelDialog({
  open,
  onOpenChange,
  sessionId,
  scheduledStart,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  scheduledStart: Date
}) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, startBusy] = useTransition()
  const advanceMs = scheduledStart.getTime() - Date.now()
  const isLate = advanceMs < 24 * 60 * 60 * 1000
  const hoursToStart = Math.max(0, Math.round(advanceMs / 3_600_000))

  function handleConfirm() {
    if (reason.trim().length < 2) {
      setError("Indicá el motivo")
      return
    }
    setError(null)
    startBusy(async () => {
      const result = await cancelClassSession({ sessionId, reason })
      if (!result.success) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Cancelar clase</DialogTitle>
          <DialogDescription>
            La clase queda cancelada. No se cuentan horas. Esta acción no se puede deshacer desde
            acá.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Motivo</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Feriado no marcado en sistema / docente con licencia médica."
              disabled={busy}
            />
          </div>
          {error && (
            <Alert variant="danger" className="mt-3">
              {error}
            </Alert>
          )}
          {isLate ? (
            <Alert variant="warn" className="mt-3">
              <AlertTriangle size={14} strokeWidth={1.6} className="text-warning" />
              <span>
                <strong>Aviso tardío.</strong> Faltan{" "}
                {hoursToStart === 0
                  ? "menos de 1 hora"
                  : `${hoursToStart} ${hoursToStart === 1 ? "hora" : "horas"}`}{" "}
                para la clase. Por política, esta cancelación queda registrada como tardía y no se
                contabilizan horas para el pago al docente.
              </span>
            </Alert>
          ) : (
            <Alert variant="warn" className="mt-3">
              <AlertTriangle size={14} strokeWidth={1.6} className="text-warning" />
              Cancelar es manual y no avisa por email a los alumnos en este MVP.
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Volver
          </Button>
          <Button type="button" variant="danger" size="md" onClick={handleConfirm} disabled={busy}>
            {busy && <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />}
            Cancelar clase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AbsenceNotice({
  noticedAt,
  scheduledStart,
  note,
}: {
  noticedAt: Date
  scheduledStart: Date
  note: string | null
}) {
  const advanceMs = scheduledStart.getTime() - noticedAt.getTime()
  const isLate = advanceMs < 24 * 60 * 60 * 1000
  return (
    <p
      className={cn(
        "mt-1 inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px]",
        isLate
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-info/40 bg-info/10 text-info",
      )}
    >
      <AlertTriangle size={11} strokeWidth={1.6} />
      <span>
        {isLate ? "Avisó tarde " : "Avisó "}({Math.max(0, Math.round(advanceMs / 3_600_000))}h
        antes)
        {note && (
          <>
            {" — "}
            <span className="italic">{note}</span>
          </>
        )}
      </span>
    </p>
  )
}

function attendanceBorderClass(s: AttendanceStatus): string {
  switch (s) {
    case AttendanceStatus.PRESENT:
      return "border-teal-500/40"
    case AttendanceStatus.LATE:
      return "border-warning/50"
    case AttendanceStatus.ABSENT:
      return "border-danger/50"
    case AttendanceStatus.EXCUSED:
      return "border-text-3/40"
    default:
      return "border-border"
  }
}

function formatGuayaquilDateLabel(d: Date): string {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(d)
}

function formatGuayaquilTimeRange(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return `${fmt.format(start)} – ${fmt.format(end)}`
}
