import type { TeacherStats } from "@/modules/teachers/queries"

/**
 * Strip de KPIs del listado de docentes — patrón visual idéntico al de
 * estudiantes, con métricas que corresponden al rol.
 */
export function StatsStrip({ stats }: { stats: TeacherStats }) {
  const cards = [
    { label: "Total", value: stats.total },
    { label: "Activos", value: stats.active, tone: "teal" as const },
    { label: "Inactivos", value: stats.inactive },
    {
      label: "Postulaciones",
      value: stats.pendingApplications,
      tone: "warning" as const,
    },
    {
      label: "Asignaciones vigentes",
      value: stats.withActiveAssignments,
      tone: "teal" as const,
    },
  ]

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="border-border bg-surface rounded-xl border px-4 py-3.5">
          <p className="text-text-3 font-mono text-[11px] tracking-[0.08em] uppercase">
            {card.label}
          </p>
          <p
            className={
              card.tone === "teal"
                ? "mt-1 font-serif text-[26px] leading-[1.1] tracking-[-0.01em] text-teal-500"
                : card.tone === "warning"
                  ? "text-warning mt-1 font-serif text-[26px] leading-[1.1] tracking-[-0.01em]"
                  : "text-foreground mt-1 font-serif text-[26px] leading-[1.1] tracking-[-0.01em]"
            }
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
