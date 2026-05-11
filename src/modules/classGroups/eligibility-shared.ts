/**
 * Tipos y predicados puros del módulo de elegibilidad. Sin Prisma, sin
 * `server-only` — pueden importarse desde componentes cliente.
 *
 * Las funciones de carga (`findCandidatesForClassGroup`, `validateTeacherForSlots`)
 * viven en `eligibility.ts` porque tocan la DB.
 */

export type SlotPattern = {
  dayOfWeek: number
  startTime: string
  durationMinutes: number
}

export type ConflictReport = {
  cefrMismatch: boolean
  uncoveredSlots: { dayOfWeek: number; startTime: string }[]
  doubleBookedSlots: {
    dayOfWeek: number
    startTime: string
    classGroupId: string
    classGroupName: string
  }[]
}

export type TeacherCandidate = {
  id: string
  firstName: string
  lastName: string
  email: string
  hourlyRate: string
  availability: { dayOfWeek: number; startTime: string; endTime: string }[]
  conflicts: ConflictReport
}

export function candidateIsEligible(c: TeacherCandidate): boolean {
  return (
    !c.conflicts.cefrMismatch &&
    c.conflicts.uncoveredSlots.length === 0 &&
    c.conflicts.doubleBookedSlots.length === 0
  )
}

export function slotIsCovered(
  slot: SlotPattern,
  availability: { dayOfWeek: number; startTime: string; endTime: string }[],
): boolean {
  const slotStart = toMinutes(slot.startTime)
  const slotEnd = slotStart + slot.durationMinutes
  return availability.some(
    (a) =>
      a.dayOfWeek === slot.dayOfWeek &&
      toMinutes(a.startTime) <= slotStart &&
      toMinutes(a.endTime) >= slotEnd,
  )
}

export function slotsOverlap(a: SlotPattern, b: SlotPattern): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false
  const aStart = toMinutes(a.startTime)
  const aEnd = aStart + a.durationMinutes
  const bStart = toMinutes(b.startTime)
  const bEnd = bStart + b.durationMinutes
  return aStart < bEnd && bStart < aEnd
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number) as [number, number]
  return h * 60 + m
}
