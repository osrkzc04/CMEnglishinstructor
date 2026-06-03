import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Render del prompt enriquecido. Soporta una sintaxis ligera tipo markdown:
 *
 *   ## texto    → encabezado nivel 2 (instrucciones, "Read.", etc.)
 *   ### texto   → encabezado nivel 3
 *   > texto     → blockquote (lecturas, citas)
 *   **texto**   → negrita
 *   *texto*     → cursiva
 *   línea en blanco → separación de párrafo
 *   salto de línea simple → respetado dentro del párrafo
 *
 * El parser es propio (sin dependencias) y deliberadamente limitado: nada de
 * links, código, listas ni HTML embebido. Esto garantiza que el campo `prompt`
 * sigue siendo texto plano en DB y que el `<RichPrompt>` no abre puerta a
 * XSS — todos los nodos se construyen como `React.createElement`, nunca
 * `dangerouslySetInnerHTML`.
 *
 * También exportamos `stripMarkdown()` para listas/tablas donde queremos
 * truncar el prompt sin que aparezcan los marcadores.
 */

type InlineNode = string | { tag: "b" | "i"; children: InlineNode[] }

function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = []
  let buf = ""
  let i = 0

  const flush = () => {
    if (buf.length > 0) {
      out.push(buf)
      buf = ""
    }
  }

  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2)
      if (end !== -1) {
        flush()
        out.push({ tag: "b", children: parseInline(text.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    } else if (text[i] === "*") {
      const end = text.indexOf("*", i + 1)
      if (end !== -1) {
        flush()
        out.push({ tag: "i", children: parseInline(text.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }
    buf += text[i]
    i++
  }
  flush()
  return out
}

function renderInline(nodes: InlineNode[], keyPrefix = ""): React.ReactNode {
  return nodes.map((n, idx) => {
    const key = `${keyPrefix}${idx}`
    if (typeof n === "string") return <React.Fragment key={key}>{n}</React.Fragment>
    if (n.tag === "b") {
      return (
        <strong key={key} className="font-semibold">
          {renderInline(n.children, `${key}-`)}
        </strong>
      )
    }
    return (
      <em key={key} className="italic">
        {renderInline(n.children, `${key}-`)}
      </em>
    )
  })
}

type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "p"; text: string }

function parseBlocks(input: string): Block[] {
  const normalized = input.replace(/\r\n/g, "\n").trim()
  const paragraphs = normalized.split(/\n{2,}/)
  return paragraphs.map((raw) => {
    const trimmed = raw.trim()
    if (trimmed.startsWith("### ")) return { kind: "h3", text: trimmed.slice(4).trim() }
    if (trimmed.startsWith("## ")) return { kind: "h2", text: trimmed.slice(3).trim() }
    // Blockquote: si al menos la primera línea arranca con ">", tratamos el
    // párrafo entero como cita y removemos el marcador de cada línea
    // (tolerando ">", "> " y líneas sin marcador dentro del bloque).
    if (trimmed.startsWith(">")) {
      const text = trimmed
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join("\n")
      return { kind: "quote", text }
    }
    return { kind: "p", text: trimmed }
  })
}

export function RichPrompt({ content, className }: { content: string; className?: string }) {
  const blocks = parseBlocks(content)

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((b, i) => {
        const key = `${b.kind}-${i}`
        const inline = renderInline(parseInline(b.text), `${i}-`)
        switch (b.kind) {
          case "h2":
            return (
              <h2
                key={key}
                className="text-foreground font-serif text-[20px] leading-[1.25] font-normal tracking-[-0.01em]"
              >
                {inline}
              </h2>
            )
          case "h3":
            return (
              <h3
                key={key}
                className="text-foreground font-serif text-[17px] leading-[1.3] font-normal tracking-[-0.005em]"
              >
                {inline}
              </h3>
            )
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-teal-500/40 text-foreground border-l-2 pl-4 leading-[1.65] whitespace-pre-line"
              >
                {inline}
              </blockquote>
            )
          case "p":
          default:
            return (
              <p key={key} className="leading-[1.55] whitespace-pre-line">
                {inline}
              </p>
            )
        }
      })}
    </div>
  )
}

/**
 * Devuelve el texto sin marcadores de formato. Útil para listas / tablas
 * donde queremos truncar o ordenar sin que aparezcan los marcadores.
 */
export function stripMarkdown(content: string): string {
  return content
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
}
