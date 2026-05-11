/**
 * Debug standalone — replica el materializer sin pasar por
 * `import "server-only"`. Útil para diagnosticar por qué la
 * materialización devuelve 0 desde la UI sin error.
 */

import { PrismaClient, ClassGroupStatus, EnrollmentStatus, SessionStatus } from "@prisma/client"

const GUAYAQUIL_OFFSET_MINUTES = -300

async function main() {
  const p = new PrismaClient()
  try {
    const group = await p.classGroup.findFirst({
      select: {
        id: true,
        name: true,
        status: true,
        modality: true,
        defaultMeetingUrl: true,
        defaultLocation: true,
        slots: {
          select: { dayOfWeek: true, startTime: true, durationMinutes: true },
        },
        teacherAssignments: {
          where: { endDate: null },
          select: { teacherId: true },
          take: 1,
        },
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          select: { id: true },
        },
      },
    })
    if (!group) {
      console.log("No class group found")
      return
    }
    console.log("Group:", {
      id: group.id,
      name: group.name,
      status: group.status,
      slots: group.slots.length,
      teacher: group.teacherAssignments[0]?.teacherId ?? "(none)",
      enrollments: group.enrollments.length,
    })

    if (group.status !== ClassGroupStatus.ACTIVE) {
      console.log("✗ Group not ACTIVE:", group.status)
      return
    }
    const teacherId = group.teacherAssignments[0]?.teacherId
    if (!teacherId) {
      console.log("✗ No active teacher")
      return
    }

    const fromDate = process.argv[2] ?? "2026-05-11"
    const toDate = process.argv[3] ?? "2026-06-08"
    console.log(`\nMaterializing ${fromDate} → ${toDate}`)

    const dates = eachGuayaquilDateInRange(fromDate, toDate)
    console.log(`Dates in range: ${dates.length}`)

    let created = 0
    let skippedHoliday = 0
    let skippedAlreadyExists = 0
    let skippedNoSlot = 0

    for (const dateStr of dates) {
      const dow = dayOfWeekForGuayaquilDate(dateStr)
      const slotsForDay = group.slots.filter((s) => s.dayOfWeek === dow)
      if (slotsForDay.length === 0) {
        skippedNoSlot += 1
        continue
      }

      for (const slot of slotsForDay) {
        const scheduledStart = guayaquilDateToUtc(dateStr, slot.startTime)
        const scheduledEnd = new Date(scheduledStart.getTime() + slot.durationMinutes * 60_000)

        const exists = await p.classSession.findFirst({
          where: { classGroupId: group.id, scheduledStart },
          select: { id: true },
        })
        if (exists) {
          skippedAlreadyExists += 1
          continue
        }

        const session = await p.classSession.create({
          data: {
            classGroupId: group.id,
            teacherId,
            scheduledStart,
            scheduledEnd,
            modality: group.modality,
            meetingUrl: group.defaultMeetingUrl,
            location: group.defaultLocation,
            status: SessionStatus.SCHEDULED,
          },
          select: { id: true },
        })
        if (group.enrollments.length > 0) {
          await p.classParticipant.createMany({
            data: group.enrollments.map((e) => ({
              sessionId: session.id,
              enrollmentId: e.id,
            })),
          })
        }
        created += 1
      }
    }

    console.log("\nResult:")
    console.log({ created, skippedHoliday, skippedAlreadyExists, skippedNoSlot })

    const total = await p.classSession.count({
      where: { classGroupId: group.id },
    })
    console.log(`Sessions now in DB for this group: ${total}`)

    if (total > 0) {
      const sample = await p.classSession.findMany({
        where: { classGroupId: group.id },
        orderBy: { scheduledStart: "asc" },
        take: 5,
        select: { scheduledStart: true, scheduledEnd: true, status: true },
      })
      console.log("Sample:", sample)
    }
  } finally {
    await p.$disconnect()
  }
}

function eachGuayaquilDateInRange(from: string, to: string): string[] {
  const result: string[] = []
  const [y0, m0, d0] = from.split("-").map(Number) as [number, number, number]
  const [y1, m1, d1] = to.split("-").map(Number) as [number, number, number]
  const start = Date.UTC(y0, m0 - 1, d0)
  const end = Date.UTC(y1, m1 - 1, d1)
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t)
    const yy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
    const dd = String(d.getUTCDate()).padStart(2, "0")
    result.push(`${yy}-${mm}-${dd}`)
  }
  return result
}

function dayOfWeekForGuayaquilDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function guayaquilDateToUtc(dateStr: string, hhmm: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number]
  const [h, min] = hhmm.split(":").map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1, d, h, min - GUAYAQUIL_OFFSET_MINUTES))
}

main().catch((e) => {
  console.error("FAILED:", e)
  process.exit(1)
})
