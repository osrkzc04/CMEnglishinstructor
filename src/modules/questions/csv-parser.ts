/**
 * Parser CSV minimalista — soporta el subset RFC 4180 que nos importa:
 *
 *   - Delimitador `,` (no parametrizable; el template de importación lo fija).
 *   - Quotes con `"`. Dentro de un quoted field, `""` se interpreta como `"`.
 *   - Newlines `\r\n`, `\n` o `\r` se normalizan como salto de fila.
 *   - Newlines dentro de quotes son parte del valor (enunciados multilínea).
 *   - Filas completamente vacías se descartan al final.
 *
 * No usamos `papaparse` para no agregar una dependencia — el formato del
 * banco es controlado por nosotros y el archivo descargable trae las reglas.
 * Si en el futuro necesitamos parsear CSV externos con variantes raras
 * (BOM, semicolons, tabs), conviene migrar a PapaParse o csv-parse.
 */

export function parseCSV(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let i = 0
  let inQuotes = false

  // Strip BOM si está presente — algunos editores en Windows lo agregan.
  if (input.charCodeAt(0) === 0xfeff) {
    i = 1
  }

  while (i < input.length) {
    const c = input[i]!

    if (inQuotes) {
      if (c === '"') {
        // `""` dentro de un quoted field = `"` literal.
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += c
        i++
      }
      continue
    }

    if (c === '"') {
      inQuotes = true
      i++
    } else if (c === ",") {
      row.push(field)
      field = ""
      i++
    } else if (c === "\r" || c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      if (c === "\r" && input[i + 1] === "\n") i += 2
      else i++
    } else {
      field += c
      i++
    }
  }

  // Última fila si no terminaba con newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Filtra filas totalmente vacías (todas las celdas son cadena vacía).
  return rows.filter((r) => r.some((cell) => cell.length > 0))
}
