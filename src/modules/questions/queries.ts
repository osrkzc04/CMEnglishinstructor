import "server-only"

import { Prisma, QuestionType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { QuestionListFiltersSchema, type QuestionListFilters } from "./schemas"

/**
 * Lecturas server-only del banco de preguntas.
 *
 * Trabajamos siempre dentro de un idioma — el banco vive por `Language` y
 * los niveles CEFR cuelgan de ahí. El default es Inglés (code "en"); si más
 * adelante coordinación administra un segundo idioma, el listado expone un
 * selector y el caller manda el `languageId` correcto.
 *
 * Las preguntas tienen snapshots inmutables al rendirse — editar una pregunta
 * NO retroactivamente cambia los intentos previos. Esto se ve en la UI con un
 * indicador "ha sido usada en N intentos" (futuro; no para etapa 1).
 */

// -----------------------------------------------------------------------------
//  Idiomas disponibles para el selector de la pantalla
// -----------------------------------------------------------------------------

export type AvailableLanguage = {
  id: string
  code: string
  name: string
}

export async function listLanguages(): Promise<AvailableLanguage[]> {
  return prisma.language.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  })
}

export async function getDefaultLanguageId(): Promise<string | null> {
  // Inglés por convención. Si no existe (caso edge en seed roto), cae al
  // primero por code.
  const english = await prisma.language.findUnique({
    where: { code: "en" },
    select: { id: true },
  })
  if (english) return english.id
  const any = await prisma.language.findFirst({
    orderBy: { code: "asc" },
    select: { id: true },
  })
  return any?.id ?? null
}

// -----------------------------------------------------------------------------
//  CEFR levels del idioma — para filtros y stats
// -----------------------------------------------------------------------------

export type CefrLevelLite = {
  id: string
  code: string
  name: string
  order: number
}

export async function listCefrLevelsForLanguage(languageId: string): Promise<CefrLevelLite[]> {
  return prisma.cefrLevel.findMany({
    where: { languageId },
    orderBy: { order: "asc" },
    select: { id: true, code: true, name: true, order: true },
  })
}

// -----------------------------------------------------------------------------
//  Stats por nivel para el strip superior
// -----------------------------------------------------------------------------

export type BankLevelStat = {
  levelId: string
  code: string
  name: string
  order: number
  activeCount: number
  // Umbral mínimo recomendado por nivel para que el sorteo del placement test
  // pueda elegir 20 sin repetir. Coincide con `TestTemplateSection.samplePoolSize`
  // default. Si en el futuro el setting cambia por plantilla, este número se
  // recalcula a partir del template real.
  recommendedMin: number
  meetsThreshold: boolean
}

/**
 * Datos por nivel para la landing del banco — extiende `BankLevelStat` con
 * la última fecha de edición y un conteo de inactivas (preguntas archivadas).
 *
 * Pensado para que coordinación vea de un vistazo qué nivel necesita atención
 * sin abrir cada uno.
 */
export type LevelOverviewItem = BankLevelStat & {
  inactiveCount: number
  lastEditedAt: Date | null
}

const DEFAULT_RECOMMENDED_MIN = 50

export async function getBankStats(languageId: string): Promise<BankLevelStat[]> {
  const levels = await listCefrLevelsForLanguage(languageId)

  // GroupBy nativo de Prisma — un solo round-trip.
  const grouped = await prisma.question.groupBy({
    by: ["levelId"],
    where: {
      isActive: true,
      level: { languageId },
    },
    _count: { _all: true },
  })
  const countByLevel = new Map(grouped.map((g) => [g.levelId, g._count._all]))

  return levels.map((l) => {
    const activeCount = countByLevel.get(l.id) ?? 0
    return {
      levelId: l.id,
      code: l.code,
      name: l.name,
      order: l.order,
      activeCount,
      recommendedMin: DEFAULT_RECOMMENDED_MIN,
      meetsThreshold: activeCount >= DEFAULT_RECOMMENDED_MIN,
    }
  })
}

/**
 * Resumen extendido para la landing — agrega últimas ediciones y conteo de
 * inactivas en una sola pasada por nivel. Tres queries en paralelo:
 *
 *  1. levels — el catálogo CEFR del idioma.
 *  2. groupBy activeCount — preguntas activas por nivel.
 *  3. groupBy inactiveCount — preguntas inactivas (archivadas) por nivel.
 *  4. lastEditedAt — `max(updatedAt)` por nivel.
 *
 * Si un nivel todavía no tiene preguntas, todas las métricas quedan en 0/null.
 */
export async function getLevelOverview(languageId: string): Promise<LevelOverviewItem[]> {
  // Usamos `Promise.all` en lugar de `$transaction([...])`: son lecturas
  // puras y la forma array del $transaction degrada el type-narrowing de
  // `groupBy` (`_count._all` queda como union impredecible).
  const [levels, activeGroups, inactiveGroups, lastEditGroups] = await Promise.all([
    prisma.cefrLevel.findMany({
      where: { languageId },
      orderBy: { order: "asc" },
      select: { id: true, code: true, name: true, order: true },
    }),
    prisma.question.groupBy({
      by: ["levelId"],
      where: { isActive: true, level: { languageId } },
      _count: { _all: true },
    }),
    prisma.question.groupBy({
      by: ["levelId"],
      where: { isActive: false, level: { languageId } },
      _count: { _all: true },
    }),
    prisma.question.groupBy({
      by: ["levelId"],
      where: { level: { languageId } },
      _max: { updatedAt: true },
    }),
  ])

  const activeByLevel = new Map(activeGroups.map((g) => [g.levelId, g._count._all]))
  const inactiveByLevel = new Map(inactiveGroups.map((g) => [g.levelId, g._count._all]))
  const lastEditByLevel = new Map(lastEditGroups.map((g) => [g.levelId, g._max.updatedAt]))

  return levels.map((l) => {
    const activeCount = activeByLevel.get(l.id) ?? 0
    const inactiveCount = inactiveByLevel.get(l.id) ?? 0
    return {
      levelId: l.id,
      code: l.code,
      name: l.name,
      order: l.order,
      activeCount,
      inactiveCount,
      recommendedMin: DEFAULT_RECOMMENDED_MIN,
      meetsThreshold: activeCount >= DEFAULT_RECOMMENDED_MIN,
      lastEditedAt: lastEditByLevel.get(l.id) ?? null,
    }
  })
}

/**
 * Resuelve el nivel CEFR a partir del code (case-insensitive) dentro de un
 * idioma. Lo usa la página drill-in para mapear `/admin/preguntas/A1` al
 * registro real.
 */
export async function getCefrLevelByCode(
  languageId: string,
  code: string,
): Promise<CefrLevelLite | null> {
  return prisma.cefrLevel.findFirst({
    where: {
      languageId,
      code: { equals: code, mode: "insensitive" },
    },
    select: { id: true, code: true, name: true, order: true },
  })
}

// -----------------------------------------------------------------------------
//  Listado paginado de preguntas
// -----------------------------------------------------------------------------

export type QuestionListItem = {
  id: string
  prompt: string
  type: QuestionType
  topic: string | null
  difficulty: number
  points: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  level: { id: string; code: string; name: string }
  optionsCount: number
  acceptedAnswersCount: number
  // Indicador para mostrar al usuario "esta pregunta ya se usó en N intentos".
  // En etapa 1 calculamos solo si fue usada (boolean) para no recargar la query
  // con un count. Si lo necesitamos exacto, lo agregamos después.
  hasBeenUsed: boolean
}

export type QuestionListResult = {
  items: QuestionListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listQuestions(
  raw: Partial<QuestionListFilters>,
): Promise<QuestionListResult> {
  const filters = QuestionListFiltersSchema.parse(raw)
  const where = buildWhere(filters)

  const [rows, total] = await prisma.$transaction([
    prisma.question.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true,
        prompt: true,
        type: true,
        topic: true,
        difficulty: true,
        points: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        level: { select: { id: true, code: true, name: true } },
        _count: {
          select: {
            options: true,
            fillAnswers: true,
          },
        },
      },
    }),
    prisma.question.count({ where }),
  ])

  // Para `hasBeenUsed` buscamos en TestSessionQuestion. Un solo round-trip con
  // IN(...). Si el banco crece mucho y el listado va lento, podemos
  // denormalizar `usageCount` a la tabla Question.
  const ids = rows.map((r) => r.id)
  const usedRows =
    ids.length === 0
      ? []
      : await prisma.testSessionQuestion.groupBy({
          by: ["questionId"],
          where: { questionId: { in: ids } },
          _count: { _all: true },
        })
  const usedSet = new Set(usedRows.filter((r) => r.questionId !== null).map((r) => r.questionId!))

  const items: QuestionListItem[] = rows.map((r) => ({
    id: r.id,
    prompt: r.prompt,
    type: r.type,
    topic: r.topic,
    difficulty: r.difficulty,
    points: r.points,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    level: r.level,
    optionsCount: r._count.options,
    acceptedAnswersCount: r._count.fillAnswers,
    hasBeenUsed: usedSet.has(r.id),
  }))

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

// -----------------------------------------------------------------------------
//  Carga para el form de edición
// -----------------------------------------------------------------------------

export type QuestionForEdit = {
  id: string
  levelId: string
  prompt: string
  type: QuestionType
  topic: string | null
  difficulty: number
  points: number
  isActive: boolean
  options: { id: string; text: string; isCorrect: boolean; order: number }[]
  acceptedAnswers: { id: string; answer: string; caseSensitive: boolean }[]
  hasBeenUsed: boolean
  level: { id: string; code: string; languageId: string }
}

export async function getQuestionForEdit(id: string): Promise<QuestionForEdit | null> {
  const row = await prisma.question.findUnique({
    where: { id },
    select: {
      id: true,
      levelId: true,
      prompt: true,
      type: true,
      topic: true,
      difficulty: true,
      points: true,
      isActive: true,
      level: { select: { id: true, code: true, languageId: true } },
      options: {
        orderBy: { order: "asc" },
        select: { id: true, text: true, isCorrect: true, order: true },
      },
      fillAnswers: {
        select: { id: true, acceptedAnswer: true, caseSensitive: true },
      },
    },
  })
  if (!row) return null

  // hasBeenUsed se calcula por separado — un solo count.
  const usageCount = await prisma.testSessionQuestion.count({
    where: { questionId: id },
  })

  return {
    id: row.id,
    levelId: row.levelId,
    prompt: row.prompt,
    type: row.type,
    topic: row.topic,
    difficulty: row.difficulty,
    points: row.points,
    isActive: row.isActive,
    level: row.level,
    options: row.options,
    acceptedAnswers: row.fillAnswers.map((a) => ({
      id: a.id,
      answer: a.acceptedAnswer,
      caseSensitive: a.caseSensitive,
    })),
    hasBeenUsed: usageCount > 0,
  }
}

// -----------------------------------------------------------------------------
//  Tópicos existentes en el idioma — para autocomplete del filtro (futuro)
// -----------------------------------------------------------------------------

export async function listTopicsForLanguage(languageId: string): Promise<string[]> {
  const rows = await prisma.question.findMany({
    where: {
      level: { languageId },
      topic: { not: null },
    },
    distinct: ["topic"],
    select: { topic: true },
    orderBy: { topic: "asc" },
  })
  return rows.map((r) => r.topic!).filter(Boolean)
}

// -----------------------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------------------

function buildWhere(filters: QuestionListFilters): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = {}

  if (filters.languageId) {
    where.level = { languageId: filters.languageId }
  }
  if (filters.levelId) {
    where.levelId = filters.levelId
  }
  if (filters.type) {
    where.type = filters.type
  }
  if (filters.topic) {
    where.topic = { equals: filters.topic, mode: "insensitive" }
  }
  if (filters.status === "ACTIVE") {
    where.isActive = true
  } else if (filters.status === "INACTIVE") {
    where.isActive = false
  }
  if (filters.q) {
    where.prompt = { contains: filters.q, mode: "insensitive" }
  }

  return where
}
