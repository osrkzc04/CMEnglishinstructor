"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, CalendarPlus, Loader2 } from "lucide-react"
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
import { materializeRange } from "@/modules/classGroups/materializeRange.action"
import type {
  ClassGroupSessionsSummary,
  ClassGroupUpcomingSession,
} from "@/modules/classGroups/queries"

const SESSION_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Programada",
  COMPLETED: "Cerrada",
  CANCELLED: "Cancelada",
  NO_SHOW: "Sin asistencia",
}

type Props = {
  classGroupId: string
  summary: ClassGroupSessionsSummary
  /** El aula debe estar ACTIVE para programar nuevas sesiones. */
  canSchedule: boolean
  /** True si el aula tiene un docente asignado. Sin docente no se puede programar. */
  hasTeacher: boolean
}

export function SessionsCard({ classGroupId, summary, canSchedule, hasTeacher }: Props) {
  const [open, setOpen] = useState(false)

  const blockedReason = !canSchedule
    ? "El aula está cerrada. No se programan más sesiones."
    : !hasTeacher
      ? "Asigná un docente al aula antes de programar sesiones."
      : null

  return (
    <>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-text-3 font-mono text-[12px] tracking-[0.08em] uppercase">
            Total
          </span>
          <span className="text-foreground font-serif text-[24px] leading-none font-normal">
            {summary.futureCount}
          </span>
          <span className="text-text-3 text-[12.5px]">programadas a futuro</span>
          {summary.pastCount > 0 && <Tag>{summary.pastCount} en historial</Tag>}
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!canSchedule || !hasTeacher}
          onClick={() => setOpen(true)}
        >
          <CalendarPlus size={13} strokeWidth={1.6} />
          Programar
        </Button>
      </header>

      {blockedReason && <p className="text-text-3 mb-3 text-[12.5px]">{blockedReason}</p>}

      {summary.upcoming.length === 0 ? (
        <p className="text-text-3 text-[13px]">
          Sin sesiones futuras. Click en <span className="font-medium">Programar</span> para crear
          las próximas clases a partir del horario semanal.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {summary.upcoming.map((s) => (
            <UpcomingSessionRow key={s.id} session={s} />
          ))}
          {summary.futureCount > summary.upcoming.length && (
            <li className="text-text-3 py-2.5 text-[12.5px]">
              + {summary.futureCount - summary.upcoming.length} más
            </li>
          )}
        </ul>
      )}

      <ScheduleDialog
        open={open}
        onOpenChange={setOpen}
        classGroupId={classGroupId}
        suggestedFromIso={suggestedFromIso(summary.lastScheduledStart)}
      />
    </>
  )
}

function UpcomingSessionRow({ session }: { session: ClassGroupUpcomingSession }) {
  const dateLabel = formatGuayaquilDateLabel(session.scheduledStart)
  const timeLabel = formatGuayaquilTimeRange(session.scheduledStart, session.scheduledEnd)
  return (
    <li className="grid grid-cols-[140px_1fr_auto] items-baseline gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="text-foreground flex items-center gap-2 text-[13px]">
        <CalendarDays size={12} strokeWidth={1.6} className="text-text-3" />
        {dateLabel}
      </div>
      <span className="text-text-2 font-mono text-[12.5px] tracking-[0.02em]">{timeLabel}</span>
      <span className="text-text-3 text-[11.5px]">
        {session.participantCount} {session.participantCount === 1 ? "alumno" : "alumnos"}
        {session.status !== "SCHEDULED" && (
          <>
            {" · "}
            <span className="text-text-4">
              {SESSION_STATUS_LABEL[session.status] ?? session.status}
            </span>
          </>
        )}
      </span>
    </li>
  )
}

function ScheduleDialog({
  open,
  onOpenChange,
  classGroupId,
  suggestedFromIso,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  classGroupId: string
  suggestedFromIso: string
}) {
  const router = useRouter()
  const [from, setFrom] = useState(suggestedFromIso)
  const [to, setTo] = useState(addWeeksToIso(suggestedFromIso, 8))
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const result = await materializeRange({
        classGroupId,
        fromDate: from,
        toDate: to,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      const { created, skippedHoliday, skippedUnavailable, skippedAlreadyExists } = result.counters
      setInfo(
        `Programadas ${created}. ` +
          [
            skippedAlreadyExists > 0 && `${skippedAlreadyExists} ya existían`,
            skippedHoliday > 0 && `${skippedHoliday} caen en feriado`,
            skippedUnavailable > 0 &&
              `${skippedUnavailable} se saltearon por unavailability del docente`,
          ]
            .filter(Boolean)
            .join(" · ") || "Sin saltos.",
      )
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Programar sesiones</DialogTitle>
          <DialogDescription>
            Genera las clases del rango respetando feriados y la unavailability del docente. Es
            idempotente: las sesiones ya creadas no se duplican.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="from-date">Desde</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to-date">Hasta</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[2, 4, 8, 12].map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  onClick={() => setTo(addWeeksToIso(from, weeks))}
                  disabled={isPending}
                  className="border-border bg-surface text-text-2 rounded-md border px-2 py-1 text-[11.5px] transition-colors hover:border-teal-500 hover:text-teal-500"
                >
                  {weeks} semanas
                </button>
              ))}
            </div>
            {error && (
              <Alert variant="danger" className="mt-3">
                {error}
              </Alert>
            )}
            {info && (
              <Alert variant="teal" className="mt-3">
                {info}
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
              Cerrar
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={isPending}>
              {isPending && <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />}
              Programar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// -----------------------------------------------------------------------------
//  Helpers — fechas en hora local Guayaquil
// -----------------------------------------------------------------------------

function suggestedFromIso(lastScheduledStart: Date | null): string {
  // Si ya hay sesiones programadas, sugerimos arrancar el día después de la
  // última. Si no, mañana.
  const base = lastScheduledStart ? new Date(lastScheduledStart) : new Date()
  const tomorrow = new Date(base.getTime() + 86_400_000)
  return toGuayaquilIso(tomorrow)
}

function addWeeksToIso(isoDate: string, weeks: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number]
  const t = Date.UTC(y, m - 1, d) + weeks * 7 * 86_400_000
  return toGuayaquilIso(new Date(t))
}

function toGuayaquilIso(d: Date): string {
  const local = new Date(d.getTime() - 5 * 3_600_000)
  const y = local.getUTCFullYear()
  const m = String(local.getUTCMonth() + 1).padStart(2, "0")
  const day = String(local.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatGuayaquilDateLabel(d: Date): string {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    weekday: "short",
    day: "2-digit",
    month: "short",
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
