import type { Route } from "next"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import { getReviewDetail } from "@/modules/tests/sessions/review-queries"
import { buildTestResultsLink } from "@/modules/tests/invites/emails"
import { SessionSummary } from "./_components/SessionSummary"
import { QuestionReviewList } from "./_components/QuestionReviewList"
import { EventsList } from "./_components/EventsList"
import { ReviewForm } from "./_components/ReviewForm"

/**
 * `/admin/pruebas/[id]` — revisión humana de un placement test.
 *
 * Solo DIRECTOR / COORDINATOR. Muestra:
 *  - Resumen de la sesión (auto-score, % por bloque, eventos sospechosos).
 *  - Lista completa de preguntas con correctas/incorrectas/sin responder
 *    para que la directora pueda inspeccionar.
 *  - Form R/W/L/S + nivel asignado + observaciones. Al guardar, marca la
 *    sesión como REVIEWED y dispara el correo de resultados al candidato.
 *  - Si ya está revisada, muestra el link de resultado (12 h de validez).
 */

export const metadata: Metadata = { title: "Revisión de evaluación" }

const SUSPICIOUS = new Set([
  "FOCUS_LOST",
  "FULLSCREEN_EXIT",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "DEVICE_MISMATCH",
  "SECTION_LOCKED",
])

export default async function RevisarPruebaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const { id } = await params

  const detail = await getReviewDetail(id)
  if (!detail) notFound()

  const { session, skillEvaluation, questions, events, cefrLevels } = detail
  const suspiciousCount = events.filter((e) => SUSPICIOUS.has(e.type)).length
  const isReviewable =
    session.status === "SUBMITTED" ||
    session.status === "TIMED_OUT" ||
    session.status === "REVIEWED"
  const resultsLink = session.resultsToken ? buildTestResultsLink(session.resultsToken) : null

  return (
    <AppShell
      role={user.role!}
      user={{
        name: user.name ?? "Sin nombre",
        email: user.email ?? "",
        roleLabel: roleLabel(user.role!),
      }}
      breadcrumbs={[
        { label: "Admin", href: "/admin/dashboard" as Route },
        { label: "Pruebas", href: "/admin/pruebas" as Route },
        { label: session.candidateName },
      ]}
    >
      <header className="mb-6">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Revisión
        </p>
        <h1 className="font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
          Evaluación de {session.candidateName.split(" ")[0]}
        </h1>
        <p className="text-text-3 mt-2 max-w-2xl text-[14px] leading-[1.55]">
          Revisa el detalle de las respuestas, registra las notas de Reading, Writing, Listening y
          Speaking, y comparte el resultado con el candidato.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SessionSummary
            detail={detail}
            eventsCount={events.length}
            suspiciousCount={suspiciousCount}
          />
          <QuestionReviewList questions={questions} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {isReviewable ? (
            <section className="border-border bg-surface rounded-xl border p-5">
              <h2 className="text-foreground font-serif text-[18px] font-normal tracking-[-0.01em]">
                Evaluación cualitativa
              </h2>
              <p className="text-text-3 mt-1 mb-4 text-[12.5px] leading-[1.5]">
                Las notas R/W/L/S son internas. El candidato verá las observaciones que escribas
                acá, no los puntajes por habilidad.
              </p>
              <ReviewForm
                sessionId={session.id}
                isReviewed={session.status === "REVIEWED"}
                cefrLevels={cefrLevels}
                initial={{
                  reading: skillEvaluation?.reading ?? null,
                  writing: skillEvaluation?.writing ?? null,
                  listening: skillEvaluation?.listening ?? null,
                  speaking: skillEvaluation?.speaking ?? null,
                  assignedLevelId: skillEvaluation?.assignedLevelId ?? null,
                  reviewerNotes: skillEvaluation?.reviewerNotes ?? session.reviewerNotes ?? null,
                }}
                resultsLink={resultsLink}
                resultsExpiresAt={session.resultsTokenExpiresAt}
              />
            </section>
          ) : (
            <section className="border-warning/40 bg-warning/[0.06] rounded-xl border p-5">
              <p className="text-warning font-mono text-[11px] tracking-[0.08em] uppercase">
                No se puede revisar todavía
              </p>
              <p className="text-foreground mt-1 text-[13px] leading-[1.5]">
                El candidato aún no ha terminado la evaluación. Cuando entregue, podrás registrar la
                evaluación cualitativa desde aquí.
              </p>
            </section>
          )}

          <EventsList events={events} />
        </aside>
      </div>
    </AppShell>
  )
}
