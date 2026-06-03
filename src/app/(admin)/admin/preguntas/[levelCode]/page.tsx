import type { Route } from "next"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { QuestionType } from "@prisma/client"
import { AppShell } from "@/components/layout/AppShell"
import { requireRole } from "@/modules/auth/guards"
import { roleLabel } from "@/modules/auth/role-labels"
import {
  getCefrLevelByCode,
  getDefaultLanguageId,
  getLevelOverview,
  listLanguages,
  listQuestions,
  listTopicsForLanguage,
} from "@/modules/questions/queries"
import { QuestionListFiltersSchema, type QuestionStatusFilter } from "@/modules/questions/schemas"
import { getWritingSectionForLevel } from "@/modules/tests/templates/queries"
import { PreguntasPager } from "../_components/PreguntasPager"
import { PreguntasTable } from "../_components/PreguntasTable"
import { PreguntasToolbar } from "../_components/PreguntasToolbar"
import { LevelHeader } from "./_components/LevelHeader"
import { LevelWritingPrompt } from "./_components/LevelWritingPrompt"

/**
 * `/admin/preguntas/[levelCode]` — vista de administración de un nivel CEFR.
 *
 * El `levelCode` es el CEFR code (a1, a2, b1...) — case-insensitive. Si el
 * code no existe en el idioma activo, 404.
 *
 * Filtros disponibles: búsqueda por enunciado, estado (activas/inactivas/
 * todas), tipo (MC/Fill) y tópico. El filtro de nivel está oculto porque
 * estamos ya dentro de uno.
 *
 * Etapa 1: solo lectura. Las acciones CRUD están presentes como afordances
 * deshabilitadas para que el usuario vea dónde van a vivir.
 */

export const metadata: Metadata = { title: "Banco de evaluación · Nivel" }

type RouteParams = { levelCode: string }
type SearchParams = {
  q?: string
  status?: string
  type?: string
  topic?: string
  languageId?: string
  page?: string
}

const VALID_STATUS = new Set<QuestionStatusFilter>(["ALL", "ACTIVE", "INACTIVE"])
const VALID_TYPE = new Set<QuestionType>(["MULTIPLE_CHOICE", "FILL_IN"])

export default async function PreguntasLevelPage({
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

  const safeStatus =
    sp.status && VALID_STATUS.has(sp.status as QuestionStatusFilter)
      ? (sp.status as QuestionStatusFilter)
      : "ACTIVE"
  const safeType =
    sp.type && VALID_TYPE.has(sp.type as QuestionType) ? (sp.type as QuestionType) : undefined

  const filters = QuestionListFiltersSchema.parse({
    q: sp.q,
    status: safeStatus,
    levelId: level.id,
    type: safeType,
    topic: sp.topic,
    languageId,
    page: sp.page,
  })

  const [overview, list, topics, writingSection] = await Promise.all([
    getLevelOverview(languageId),
    listQuestions(filters),
    listTopicsForLanguage(languageId),
    getWritingSectionForLevel(languageId, level.id),
  ])

  const levelOverview = overview.find((o) => o.levelId === level.id)
  if (!levelOverview) notFound()

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
        { label: "Banco de evaluación", href: "/admin/preguntas" as Route },
        { label: level.code },
      ]}
    >
      <LevelHeader level={levelOverview} />

      <PreguntasToolbar
        initialQuery={filters.q ?? ""}
        initialStatus={filters.status}
        initialLevelId={level.id}
        initialType={filters.type ?? "ALL"}
        initialTopic={filters.topic ?? ""}
        cefrLevels={[]}
        topics={topics}
        languageId={languageId}
        hideLevelFilter
      />

      <PreguntasTable items={list.items} hideLevelColumn />

      {list.totalPages > 1 && (
        <PreguntasPager
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
          pageSize={list.pageSize}
        />
      )}

      {writingSection && (
        <LevelWritingPrompt
          templateId={writingSection.templateId}
          sectionId={writingSection.sectionId}
          levelCode={level.code}
          passingPercent={writingSection.passingPercent}
          initialPrompt={writingSection.writingPrompt}
        />
      )}
    </AppShell>
  )
}
