/**
 * Cálculo del "heatmap" de horarios viables para un aula nueva.
 *
 * Función pura — sin Prisma, sin red. Recibe la disponibilidad del docente,
 * sus conflictos vigentes (aulas activas), los horarios preferidos de los
 * estudiantes seleccionados y la duración por clase del nivel. Devuelve la
 * grilla anotada celda por celda para que la UI la pinte.
 *
 * La celda representa "arrancar una clase acá". Una celda es viable si:
 *   - El docente tiene un bloque de availability que cubre [start, start+duration]
 *   - No hay ningún conflicto del docente que se solape con [start, start+duration]
 *   - studentsCovered cuenta cuántos estudiantes tienen un bloque que cubre [start, start+duration]
 */

const SLOT_MINUTES = 15
const START_HOUR = 6
const END_HOUR = 22
export const HEATMAP_SLOTS_PER_DAY = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES // 64
export const HEATMAP_START_HOUR = START_HOUR
export const HEATMAP_SLOT_MINUTES = SLOT_MINUTES

export const HEATMAP_DAYS = [
  { idx: 1, short: "Lun" },
  { idx: 2, short: "Mar" },
  { idx: 3, short: "Mié" },
  { idx: 4, short: "Jue" },
  { idx: 5, short: "Vie" },
  { idx: 6, short: "Sáb" },
  { idx: 0, short: "Dom" },
] as const

export type HeatmapBlock = {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export type HeatmapConflict = {
  dayOfWeek: number
  startTime: string
  durationMinutes: number
  classGroupName: string
}

export type HeatmapStudent = {
  enrollmentId: string
  fullName: string
  preferredSchedule: HeatmapBlock[]
}

export type HeatmapInput = {
  /** `null` = no hay docente seleccionado; el heatmap muestra solo intersección de estudiantes. */
  teacherAvailability: HeatmapBlock[] | null
  /** Conflictos vigentes del docente (otras aulas). Vacío si no hay docente. */
  teacherConflicts: HeatmapConflict[]
  /** Estudiantes seleccionados con su horario preferido. */
  students: HeatmapStudent[]
  /** Duración de la clase para validar que el bloque [start, start+duration] cabe. */
  durationMinutes: number
}

export type CellKind =
  /**
   * Match completo: docente cubre y TODOS los estudiantes seleccionados con
   * horario también. Es el color "el slot funciona" — el coordinador clickea
   * estos sin pensarlo.
   */
  | "match"
  /**
   * Match parcial: docente cubre pero solo algunos estudiantes (mostramos
   * `studentsCovered/studentsTotal` en la celda). Sirve para grupos donde
   * uno o dos quedan afuera y se ubican en otra aula.
   */
  | "partial"
  /**
   * Solo docente disponible: docente cubre pero ningún estudiante con
   * horario calza, o no hay estudiantes seleccionados todavía. La celda es
   * clickeable (se puede armar el aula y sumar alumnos después) pero no
   * representa un match.
   */
  | "teacher_only"
  /**
   * Solo estudiantes disponibles: el docente NO cubre, pero algunos
   * estudiantes sí. No es bookable mientras el docente no tenga
   * disponibilidad ahí. Lo dejamos visible para que el coordinador detecte
   * que conviene revisar la disponibilidad del docente.
   */
  | "students_only"
  /**
   * Sin disponibilidad: ninguno de los seleccionados cubre el bloque, o
   * tampoco hay nadie seleccionado.
   */
  | "gray"
  /**
   * El docente tiene otra aula que se solapa con este bloque — bookear acá
   * generaría doble-booking.
   */
  | "blocked"

export type HeatmapCell = {
  dayOfWeek: number
  /** Hora de inicio en formato "HH:mm". */
  startTime: string
  /** Cantidad de estudiantes seleccionados cuyo horario cubre el bloque. */
  studentsCovered: number
  /** Total de estudiantes seleccionados con horario cargado. */
  studentsTotal: number
  /** Cubre el docente este bloque (si hay docente seleccionado). */
  teacherCovers: boolean
  /** Hay conflicto del docente con otra aula? */
  teacherConflicts: { classGroupName: string }[]
  kind: CellKind
}

export type Heatmap = {
  durationMinutes: number
  studentsTotal: number
  cells: HeatmapCell[]
}

export function computeAvailabilityHeatmap(input: HeatmapInput): Heatmap {
  const { teacherAvailability, teacherConflicts, students, durationMinutes } = input

  const studentsWithSchedule = students.filter((s) => s.preferredSchedule.length > 0)

  const cells: HeatmapCell[] = []

  for (const day of HEATMAP_DAYS) {
    for (let i = 0; i < HEATMAP_SLOTS_PER_DAY; i++) {
      const startMinutes = START_HOUR * 60 + i * SLOT_MINUTES
      const endMinutes = startMinutes + durationMinutes
      // Si el bloque se sale del rango (24h), descartar.
      if (endMinutes > END_HOUR * 60) {
        continue
      }
      const startTime = formatHHmm(startMinutes)

      const teacherCovers =
        teacherAvailability === null
          ? false
          : blockCovers(teacherAvailability, day.idx, startMinutes, endMinutes)

      const teacherBlocks = teacherConflicts
        .filter((c) =>
          rangesOverlap(
            day.idx,
            startMinutes,
            endMinutes,
            c.dayOfWeek,
            toMinutes(c.startTime),
            toMinutes(c.startTime) + c.durationMinutes,
          ),
        )
        .map((c) => ({ classGroupName: c.classGroupName }))

      const studentsCovered = studentsWithSchedule.filter((s) =>
        blockCovers(s.preferredSchedule, day.idx, startMinutes, endMinutes),
      ).length

      const kind = computeCellKind({
        teacherSelected: teacherAvailability !== null,
        teacherCovers,
        teacherBlocked: teacherBlocks.length > 0,
        studentsTotal: studentsWithSchedule.length,
        studentsCovered,
      })

      cells.push({
        dayOfWeek: day.idx,
        startTime,
        studentsCovered,
        studentsTotal: studentsWithSchedule.length,
        teacherCovers: teacherAvailability === null ? false : teacherCovers,
        teacherConflicts: teacherBlocks,
        kind,
      })
    }
  }

  return {
    durationMinutes,
    studentsTotal: studentsWithSchedule.length,
    cells,
  }
}

// -----------------------------------------------------------------------------
//  Decisión de color por celda — pura, fácil de testear
// -----------------------------------------------------------------------------

/**
 * Tabla de decisión:
 *
 *   docente   docente   alumnos    alumnos      → kind
 *   sel.      cubre     hay        cubren todos
 *   sí        conflicto -          -            → blocked
 *   sí        no        sí         todos        → students_only (docente no cubre)
 *   sí        no        sí         algunos      → students_only
 *   sí        no        sí         ninguno      → gray
 *   sí        no        no         -            → gray
 *   sí        sí        sí         todos        → match  ⭐
 *   sí        sí        sí         algunos      → partial
 *   sí        sí        sí         ninguno      → teacher_only
 *   sí        sí        no         -            → teacher_only
 *   no        -         sí         todos        → students_only
 *   no        -         sí         algunos      → partial (con count)
 *   no        -         sí         ninguno      → gray
 *   no        -         no         -            → gray
 */
export function computeCellKind(args: {
  teacherSelected: boolean
  teacherCovers: boolean
  teacherBlocked: boolean
  studentsTotal: number
  studentsCovered: number
}): CellKind {
  const { teacherSelected, teacherCovers, teacherBlocked, studentsTotal, studentsCovered } = args

  if (teacherSelected && teacherBlocked) return "blocked"

  // Docente seleccionado y NO cubre.
  if (teacherSelected && !teacherCovers) {
    return studentsCovered > 0 ? "students_only" : "gray"
  }

  // Docente seleccionado y cubre, o no hay docente.
  if (studentsTotal === 0) {
    return teacherSelected ? "teacher_only" : "gray"
  }
  if (studentsCovered === 0) {
    return teacherSelected ? "teacher_only" : "gray"
  }
  if (studentsCovered === studentsTotal) {
    return teacherSelected ? "match" : "students_only"
  }
  return "partial"
}

// -----------------------------------------------------------------------------
//  Helpers privados
// -----------------------------------------------------------------------------

function blockCovers(
  blocks: HeatmapBlock[],
  day: number,
  startMin: number,
  endMin: number,
): boolean {
  return blocks.some(
    (b) =>
      b.dayOfWeek === day && toMinutes(b.startTime) <= startMin && toMinutes(b.endTime) >= endMin,
  )
}

function rangesOverlap(
  dayA: number,
  startA: number,
  endA: number,
  dayB: number,
  startB: number,
  endB: number,
): boolean {
  if (dayA !== dayB) return false
  return startA < endB && startB < endA
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number) as [number, number]
  return h * 60 + m
}

function formatHHmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}
