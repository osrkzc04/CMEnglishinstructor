import type { Route } from "next"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getCefrLevelByCode,
  getDefaultLanguageId,
  getQuestionForEdit,
  listLanguages,
} from "@/modules/questions/queries"
import { QuestionForm } from "../../_components/QuestionForm"

export const metadata: Metadata = { title: "Editar pregunta" }

type RouteParams = { levelCode: string; questionId: string }
type SearchParams = { languageId?: string }

export default async function EditarPreguntaPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<SearchParams>
}) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const { levelCode, questionId } = await params
  const sp = await searchParams

  const languages = await listLanguages()
  const defaultLanguageId = await getDefaultLanguageId()
  const requestedLanguageId =
    sp.languageId && languages.some((l) => l.id === sp.languageId) ? sp.languageId : null
  const languageId = requestedLanguageId ?? defaultLanguageId
  if (!languageId) notFound()

  const level = await getCefrLevelByCode(languageId, levelCode)
  if (!level) notFound()

  const question = await getQuestionForEdit(questionId)
  if (!question) notFound()
  // Validación defensiva: la pregunta tiene que pertenecer al nivel de la URL
  // y al idioma activo. Si no, 404.
  if (question.levelId !== level.id || question.level.languageId !== languageId) {
    notFound()
  }

  const cancelHref = `/admin/preguntas/${level.code.toLowerCase()}` as Route

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
        { label: "Banco de preguntas", href: "/admin/preguntas" as Route },
        { label: level.code, href: cancelHref },
        { label: "Editar" },
      ]}
    >
      <header className="mb-6 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Banco · {level.code}
        </p>
        <h1 className="font-serif text-[28px] leading-[1.18] font-normal tracking-[-0.02em]">
          Editar pregunta
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Edita el enunciado, las opciones o el estado. Los cambios solo afectan a futuros sorteos —
          los intentos ya rendidos congelan los datos al momento de presentar la prueba.
        </p>
      </header>

      <QuestionForm
        mode="edit"
        level={{ id: level.id, code: level.code, name: level.name }}
        initial={{
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          topic: question.topic,
          points: question.points,
          options: question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          acceptedAnswers: question.acceptedAnswers.map((a) => ({
            answer: a.answer,
            caseSensitive: a.caseSensitive,
          })),
          hasBeenUsed: question.hasBeenUsed,
        }}
        cancelHref={cancelHref}
      />
    </AppShell>
  )
}
