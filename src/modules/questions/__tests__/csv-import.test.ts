import { describe, it, expect } from "vitest"

import { parseCSV } from "../csv-parser"
import { validateImport, buildCsvTemplate, CSV_HEADERS } from "../import"

// =============================================================================
//  parseCSV
// =============================================================================

describe("parseCSV", () => {
  it("parsea filas básicas", () => {
    const out = parseCSV("a,b,c\n1,2,3\n4,5,6")
    expect(out).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ])
  })

  it("soporta CRLF y LF mezclados", () => {
    const out = parseCSV("a,b\r\nc,d\nx,y\r")
    expect(out).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["x", "y"],
    ])
  })

  it("respeta comillas con comas embebidas", () => {
    const out = parseCSV('a,"b, with comma",c')
    expect(out).toEqual([["a", "b, with comma", "c"]])
  })

  it('interpreta `""` dentro de quotes como comilla literal', () => {
    const out = parseCSV('a,"He said ""hello""",b')
    expect(out).toEqual([["a", 'He said "hello"', "b"]])
  })

  it("permite newlines dentro de quotes", () => {
    const out = parseCSV('a,"line one\nline two",b')
    expect(out).toEqual([["a", "line one\nline two", "b"]])
  })

  it("descarta filas totalmente vacías", () => {
    const out = parseCSV("a,b\n\n\nc,d\n")
    expect(out).toEqual([
      ["a", "b"],
      ["c", "d"],
    ])
  })

  it("descarta BOM al inicio", () => {
    const out = parseCSV("﻿a,b\n1,2")
    expect(out).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })
})

// =============================================================================
//  validateImport
// =============================================================================

function buildHeader(): string {
  return CSV_HEADERS.join(",")
}

const NO_EXISTING = new Set<string>()

describe("validateImport — happy paths", () => {
  it("acepta una MC válida con 4 opciones y correcta A", () => {
    const csv = buildHeader() + "\n" + 'A1,MC,"How ___ you?",grammar,1,are,is,am,were,A,,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.ok).toBe(1)
    expect(result.duplicates).toBe(0)
    expect(result.errors).toBe(0)
    const row = result.rows[0]!
    expect(row.status).toBe("ok")
    expect(row.type).toBe("MULTIPLE_CHOICE")
    expect(row.payload?.kind).toBe("mc")
    if (row.payload?.kind === "mc") {
      expect(row.payload.options).toHaveLength(4)
      const correctOption = row.payload.options.find((o) => o.isCorrect)
      expect(correctOption?.text).toBe("are")
    }
  })

  it("acepta una FILL válida con varias respuestas", () => {
    const csv = buildHeader() + "\n" + "A1,FILL,Past tense of go,grammar,1,,,,,,went;goed,false"
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.ok).toBe(1)
    const row = result.rows[0]!
    expect(row.type).toBe("FILL_IN")
    if (row.payload?.kind === "fill") {
      expect(row.payload.acceptedAnswers).toEqual([
        { answer: "went", caseSensitive: false },
        { answer: "goed", caseSensitive: false },
      ])
    }
  })

  it("admite MC con múltiples opciones correctas separadas por coma", () => {
    const csv = buildHeader() + "\n" + 'A1,MC,"Pick all even numbers",math,1,2,3,4,5,"A,C",,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.ok).toBe(1)
    const row = result.rows[0]!
    if (row.payload?.kind === "mc") {
      const correct = row.payload.options.filter((o) => o.isCorrect).map((o) => o.text)
      expect(correct).toEqual(["2", "4"])
    }
  })
})

describe("validateImport — duplicados y errores", () => {
  it("marca dup cuando el prompt ya existe en el banco (case-insensitive)", () => {
    const csv = buildHeader() + "\n" + 'A1,MC,"How ARE you?",grammar,1,are,is,am,were,A,,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: new Set(["how are you?"]),
    })
    expect(result.ok).toBe(0)
    expect(result.duplicates).toBe(1)
    expect(result.rows[0]?.status).toBe("dup")
  })

  it("marca dup cuando se repite el mismo prompt en el batch", () => {
    const csv =
      buildHeader() +
      "\n" +
      'A1,MC,"Same prompt",grammar,1,a,b,c,d,A,,' +
      "\n" +
      'A1,MC,"Same prompt",grammar,1,x,y,z,w,B,,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.ok).toBe(1)
    expect(result.duplicates).toBe(1)
    expect(result.rows.map((r) => r.status)).toEqual(["ok", "dup"])
  })

  it("rechaza level distinto al de la importación", () => {
    const csv = buildHeader() + "\n" + 'B2,MC,"Wrong level",grammar,1,a,b,c,d,A,,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.errors).toBe(1)
    expect(result.rows[0]?.status).toBe("error")
    expect(result.rows[0]?.errors[0]).toMatch(/level "B2"/)
  })

  it("rechaza MC sin opciones suficientes", () => {
    const csv = buildHeader() + "\n" + 'A1,MC,"prompt",grammar,1,only,,,,A,,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.errors).toBe(1)
    expect(result.rows[0]?.errors.join("|")).toMatch(/al menos 2 opciones/)
  })

  it("rechaza MC sin correcta válida (letra apunta a opción vacía)", () => {
    const csv = buildHeader() + "\n" + 'A1,MC,"prompt",grammar,1,a,b,,,D,,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.errors).toBe(1)
    expect(result.rows[0]?.errors.join("|")).toMatch(/no apunta a ninguna opción/)
  })

  it("rechaza FILL sin respuestas", () => {
    const csv = buildHeader() + "\n" + 'A1,FILL,"prompt",grammar,1,,,,,,,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.errors).toBe(1)
    expect(result.rows[0]?.errors.join("|")).toMatch(/al menos una respuesta/)
  })

  it("rechaza type desconocido", () => {
    const csv = buildHeader() + "\n" + 'A1,UNKNOWN,"prompt",grammar,1,a,b,c,d,A,,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.errors).toBe(1)
    expect(result.rows[0]?.errors.join("|")).toMatch(/type "UNKNOWN"/)
  })

  it("rechaza points fuera de rango", () => {
    const csv = buildHeader() + "\n" + 'A1,MC,"prompt",grammar,99,a,b,c,d,A,,'
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.errors).toBe(1)
    expect(result.rows[0]?.errors.join("|")).toMatch(/points/)
  })
})

describe("validateImport — edge cases", () => {
  it("devuelve parseError si el archivo está vacío", () => {
    const result = validateImport("", {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.parseError).toBeTruthy()
    expect(result.total).toBe(0)
  })

  it("devuelve parseError si solo hay header", () => {
    const result = validateImport(buildHeader(), {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.parseError).toBeTruthy()
  })

  it("flagea cuando faltan columnas (header warning)", () => {
    const partialHeader = "level,type,prompt"
    const csv = partialHeader + "\n" + "A1,MC,test"
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.headerWarning).toBeTruthy()
  })
})

// =============================================================================
//  buildCsvTemplate
// =============================================================================

describe("buildCsvTemplate", () => {
  it("genera un CSV con headers + dos ejemplos parsables", () => {
    const csv = buildCsvTemplate("A1")
    const result = validateImport(csv, {
      levelCode: "A1",
      existingPromptsLowercased: NO_EXISTING,
    })
    expect(result.parseError).toBeNull()
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]?.status).toBe("ok")
    expect(result.rows[1]?.status).toBe("ok")
  })

  it("el level del template matchea el code pasado", () => {
    const csv = buildCsvTemplate("C2")
    expect(csv).toMatch(/^level,/)
    expect(csv).toContain("C2,MC")
    expect(csv).toContain("C2,FILL")
  })
})
