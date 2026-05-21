import type { InviteStats } from "@/modules/tests/invites/queries"

export function StatsStrip({ stats }: { stats: InviteStats }) {
  const cards = [
    { label: "Total", value: stats.total },
    { label: "Por entregar", value: stats.pending, tone: "teal" as const },
    { label: "En curso", value: stats.inProgress },
    { label: "Por revisar", value: stats.awaitingReview, tone: "warning" as const },
    { label: "Revisadas", value: stats.reviewed, tone: "teal" as const },
    { label: "Vencidas", value: stats.expired },
  ]

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
