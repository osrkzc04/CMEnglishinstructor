import { QuestionType } from "@prisma/client"
import { parseCSV } from "./csv-parser"

/**
 * Validación y conversión de un CSV del banco de preguntas a estructuras
 * listas para `createQuestion`. Pensado para correr server-side dentro de
 * la action de importación (recibe el texto y devuelve preview + payload).
 *
 * Formato esperado del archivo:
 *
 *   level,type,prompt,topic,points,option_a,option_b,option_c,option_d,correct,fill_answers,fill_case_sensitive
 *
 * Reglas:
 *  - `level` (req): debe ser uno de los CEFR codes del nivel destino (la
 *    importación es por nivel, así que si la columna trae otro se marca
 *    error — defensa para evitar pifias).
 *  - `type` (req): `MC` (multiple choice) o `FILL` (fill in the blank).
 *  - `prompt` (req).
 *  - `topic` (opt).
 *  - `points` (opt, default 1, entero 1..10).
 *  - Para `MC`: al menos 2 columnas `option_*` no vacías y `correct` con al
 *    menos una letra (A..D) que apunte a una opción no vacía.
 *  - Para `FILL`: `fill_answers` separado por `;`, al menos una. `fill_case_sensitive`
 *    opcional (`true`/`false`, default `false`).
 *
 * Estados por fila:
 *  - `ok`: pasa validación y no es duplicada (prompt no existe en el nivel).
 *  - `dup`: pasa validación pero el prompt normalizado (lower + trim) ya está
 *    como pregunta activa o inactiva en el nivel.
 *  - `error`: una o más reglas fallaron — `errors[]` contiene el detalle.
 */

export const CSV_HEADERS = [
  "level",
  "type",
  "prompt",
  "topic",
  "points",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct",
  "fill_answers",
  "fill_case_sensitive",
] as const

export type ImportedPayload =
  | {
      kind: "mc"
      prompt: string
      topic: string | null
      points: number
      options: { text: string; isCorrect: boolean }[]
    }
  | {
      kind: "fill"
      prompt: string
      topic: string | null
      points: number
      acceptedAnswers: { answer: string; caseSensitive: boolean }[]
    }

export type PreviewRow = {
  rowNumber: number
  status: "ok" | "dup" | "error"
  errors: string[]
  // El prompt y el tipo siempre se intentan extraer para mostrar la fila en
  // la preview aún cuando haya errores.
  prompt: string | null
  type: "MULTIPLE_CHOICE" | "FILL_IN" | null
  payload: ImportedPayload | null
}

export type PreviewSummary = {
  rows: PreviewRow[]
  total: number
  ok: number
  duplicates: number
  errors: number
  parseError: string | null
  /** Headers que faltan o están en otro orden — no fatal, lo flageamos. */
  headerWarning: string | null
}

const OPTION_LETTERS = ["A", "B", "C", "D"] as const

export function validateImport(
  csvText: string,
  ctx: {
    levelCode: string
    existingPromptsLowercased: Set<string>
  },
): PreviewSummary {
  if (!csvText.trim()) {
    return blankSummary("El archivo está vacío.")
  }

  let table: string[][]
  try {
    table = parseCSV(csvText)
  } catch (err) {
    return blankSummary(
      `No pudimos leer el CSV: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (table.length < 2) {
    return blankSummary(
      "El archivo no tiene filas. Asegurate de incluir la cabecera y al menos una pregunta.",
    )
  }

  const [headerRow, ...dataRows] = table
  const headers = headerRow!.map((h) => h.trim().toLowerCase())
  const headerWarning = computeHeaderWarning(headers)

  // Construimos un mapa de header→índice para tolerar columnas extra o
  // reordenadas. Si una columna esperada no aparece, dejamos undefined y
  // las filas la verán como vacía.
  const idx: Record<(typeof CSV_HEADERS)[number], number> = {} as never
  for (const h of CSV_HEADERS) {
    idx[h] = headers.indexOf(h)
  }

  const seenPromptsInBatch = new Set<string>()
  const rows: PreviewRow[] = []
  let ok = 0
  let duplicates = 0
  let errors = 0

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i]!
    const rowNumber = i + 2 // 1 = header, 2 = primera fila de datos
    const get = (h: (typeof CSV_HEADERS)[number]): string => {
      const k = idx[h]
      if (k === -1) return ""
      return (cells[k] ?? "").trim()
    }

    const rowErrors: string[] = []
    const levelRaw = get("level")
    const typeRaw = get("type").toUpperCase()
    const prompt = get("prompt")
    const topic = get("topic")
    const pointsRaw = get("points")

    if (!levelRaw) {
      rowErrors.push("falta `level`")
    } else if (levelRaw.toUpperCase() !== ctx.levelCode.toUpperCase()) {
      rowErrors.push(
        `level "${levelRaw}" no coincide con el nivel de la importación (${ctx.levelCode})`,
      )
    }

    let type: "MULTIPLE_CHOICE" | "FILL_IN" | null = null
    if (typeRaw === "MC" || typeRaw === "MULTIPLE_CHOICE") type = "MULTIPLE_CHOICE"
    else if (typeRaw === "FILL" || typeRaw === "FILL_IN") type = "FILL_IN"
    else if (typeRaw === "") rowErrors.push("falta `type` (usa `MC` o `FILL`)")
    else rowErrors.push(`type "${typeRaw}" inválido (usa \`MC\` o \`FILL\`)`)

    if (!prompt) rowErrors.push("falta `prompt`")

    let points = 1
    if (pointsRaw) {
      const n = Number(pointsRaw)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 10) {
        rowErrors.push(`points "${pointsRaw}" debe ser entero 1..10`)
      } else {
        points = n
      }
    }

    let payload: ImportedPayload | null = null
    if (rowErrors.length === 0 && type === "MULTIPLE_CHOICE") {
      const optionTexts: string[] = [
        get("option_a"),
        get("option_b"),
        get("option_c"),
        get("option_d"),
      ]
      const nonEmpty = optionTexts
        .map((t, j) => ({ letter: OPTION_LETTERS[j]!, text: t }))
        .filter((o) => o.text.length > 0)
      if (nonEmpty.length < 2) {
        rowErrors.push("MC requiere al menos 2 opciones no vacías (option_a..option_d)")
      } else {
        const correctRaw = get("correct").toUpperCase()
        const correctLetters = correctRaw
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        if (correctLetters.length === 0) {
          rowErrors.push(
            "`correct` está vacío — indicá la(s) letra(s) de la(s) opción(es) correcta(s)",
          )
        } else {
          const invalidLetters = correctLetters.filter((l) => !OPTION_LETTERS.includes(l as never))
          if (invalidLetters.length > 0) {
            rowErrors.push(`letras inválidas en \`correct\`: ${invalidLetters.join(", ")}`)
          }
          const correctSet = new Set(correctLetters)
          const matchedNonEmpty = nonEmpty.filter((o) => correctSet.has(o.letter))
          if (matchedNonEmpty.length === 0) {
            rowErrors.push("`correct` no apunta a ninguna opción no vacía")
          }
          if (rowErrors.length === 0) {
            payload = {
              kind: "mc",
              prompt,
              topic: topic || null,
              points,
              options: nonEmpty.map((o) => ({
                text: o.text,
                isCorrect: correctSet.has(o.letter),
              })),
            }
          }
        }
      }
    }

    if (rowErrors.length === 0 && type === "FILL_IN") {
      const fillRaw = get("fill_answers")
      const csRaw = get("fill_case_sensitive").toLowerCase()
      const answers = fillRaw
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      if (answers.length === 0) {
        rowErrors.push("FILL requiere al menos una respuesta en `fill_answers` (separadas por `;`)")
      } else if (answers.length > 6) {
        rowErrors.push("máximo 6 respuestas en `fill_answers`")
      } else {
        let caseSensitive = false
        if (csRaw === "true" || csRaw === "1" || csRaw === "yes") caseSensitive = true
        else if (csRaw === "" || csRaw === "false" || csRaw === "0" || csRaw === "no")
          caseSensitive = false
        else rowErrors.push(`fill_case_sensitive "${csRaw}" inválido (usa \`true\` o \`false\`)`)

        if (rowErrors.length === 0) {
          payload = {
            kind: "fill",
            prompt,
            topic: topic || null,
            points,
            acceptedAnswers: answers.map((a) => ({ answer: a, caseSensitive })),
          }
        }
      }
    }

    // Decide status final.
    let status: PreviewRow["status"] = "error"
    if (rowErrors.length === 0 && payload) {
      const promptKey = prompt.toLowerCase()
      if (ctx.existingPromptsLowercased.has(promptKey) || seenPromptsInBatch.has(promptKey)) {
        status = "dup"
        duplicates += 1
      } else {
        status = "ok"
        seenPromptsInBatch.add(promptKey)
        ok += 1
      }
    } else {
      errors += 1
    }

    rows.push({
      rowNumber,
      status,
      errors: rowErrors,
      prompt: prompt || null,
      type,
      payload: status === "ok" ? payload : null,
    })
  }

  return {
    rows,
    total: rows.length,
    ok,
    duplicates,
    errors,
    parseError: null,
    headerWarning,
  }
}

function computeHeaderWarning(headers: string[]): string | null {
  const missing = CSV_HEADERS.filter((h) => !headers.includes(h))
  if (missing.length === 0) return null
  return `Faltan o están renombradas estas columnas: ${missing.join(", ")}. Se tratarán como vacías.`
}

function blankSummary(parseError: string): PreviewSummary {
  return {
    rows: [],
    total: 0,
    ok: 0,
    duplicates: 0,
    errors: 0,
    parseError,
    headerWarning: null,
  }
}

// -----------------------------------------------------------------------------
//  Template CSV (string) — descargable
// -----------------------------------------------------------------------------

/**
 * Genera el CSV de ejemplo para que coordinación lo descargue, lo edite en
 * Excel/Sheets y lo suba. Incluye headers + dos filas: una MC y una FILL.
 */
export function buildCsvTemplate(levelCode: string): string {
  const header = CSV_HEADERS.join(",")
  const mcSample = [
    levelCode,
    "MC",
    '"How ___ you today?"',
    "grammar",
    "1",
    "are",
    "is",
    "am",
    "were",
    "A",
    "",
    "",
  ].join(",")
  const fillSample = [
    levelCode,
    "FILL",
    '"Write the past tense of: go"',
    "grammar",
    "1",
    "",
    "",
    "",
    "",
    "",
    "went",
    "false",
  ].join(",")
  return `${header}\n${mcSample}\n${fillSample}\n`
}
