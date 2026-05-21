import type { Route } from "next"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getCefrLevelByCode,
  getDefaultLanguageId,
  listLanguages,
} from "@/modules/questions/queries"
import { QuestionForm } from "../_components/QuestionForm"

export const metadata: Metadata = { title: "Nueva pregunta" }

type RouteParams = { levelCode: string }
type SearchParams = { languageId?: string }

export default async function NuevaPreguntaPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<SearchParams>
}) {
  const user = await requireRole(["DIRECTOR", "COORDINATOR"])
  const { levelCode } = await params
  const sp = await searchParams

  const languages = await listLanguages()
  const defaultLanguageId = await getDefaultLanguageId()
  const requestedLanguageId =
    sp.languageId && languages.some((l) => l.id === sp.languageId) ? sp.languageId : null
  const languageId = requestedLanguageId ?? defaultLanguageId
  if (!languageId) notFound()

  const level = await getCefrLevelByCode(languageId, levelCode)
  if (!level) notFound()

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
        { label: "Nueva" },
      ]}
    >
      <header className="mb-6 max-w-2xl">
        <p className="text-text-3 mb-2 font-mono text-[12px] tracking-[0.08em] uppercase">
          Banco · {level.code}
        </p>
        <h1 className="font-serif text-[28px] leading-[1.18] font-normal tracking-[-0.02em]">
          Nueva pregunta — {level.name}
        </h1>
        <p className="text-text-3 mt-2 text-[14px] leading-[1.55]">
          Carga una pregunta nueva al banco del nivel {level.code}. Elige el tipo, escribe el
          enunciado y las opciones o respuestas aceptadas.
        </p>
      </header>

      <QuestionForm
        mode="create"
        level={{ id: level.id, code: level.code, name: level.name }}
        cancelHref={cancelHref}
      />
    </AppShell>
  )
}
