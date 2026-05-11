import type { StudentStats } from "@/modules/students/queries"

/**
 * Strip de KPIs sobre la tabla. Métricas calculadas en el server y pasadas
 * como props — se renderizan estáticas para que el listado siga siendo el
 * foco visual.
 */
export function StatsStrip({ stats }: { stats: StudentStats }) {
  const cards = [
    { label: "Total", value: stats.total },
    { label: "Activos", value: stats.active, tone: "teal" as const },
    { label: "Pendientes", value: stats.pendingApproval, tone: "warning" as const },
    { label: "Inactivos", value: stats.inactive },
    {
      label: "Matrículas activas",
      value: stats.activeEnrollments,
      tone: "teal" as const,
    },
  ]

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-surface px-4 py-3.5"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
            {card.label}
          </p>
          <p
            className={
              card.tone === "teal"
                ? "mt-1 font-serif text-[26px] leading-[1.1] tracking-[-0.01em] text-teal-500"
                : card.tone === "warning"
                  ? "mt-1 font-serif text-[26px] leading-[1.1] tracking-[-0.01em] text-warning"
                  : "mt-1 font-serif text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground"
            }
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
