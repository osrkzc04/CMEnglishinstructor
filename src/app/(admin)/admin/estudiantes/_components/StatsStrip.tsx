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
