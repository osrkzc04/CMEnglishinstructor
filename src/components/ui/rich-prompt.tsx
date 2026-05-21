import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Render del prompt enriquecido. Soporta una sintaxis ligera tipo markdown:
 *
 *   **texto**  → negrita
 *   *texto*    → cursiva
 *   línea en blanco → separación de párrafo
 *   salto de línea simple → respetado dentro del párrafo
 *
 * El parser es propio (sin dependencias) y deliberadamente limitado: nada de
 * links, código, listas o HTML embebido. Esto garantiza que el campo `prompt`
 * sigue siendo texto plano en DB y que el `<RichPrompt>` no abre puerta a
 * XSS — todos los nodos se construyen como `React.createElement`, nunca
 * `dangerouslySetInnerHTML`.
 *
 * También exportamos `stripMarkdown()` para listas/tablas donde queremos
 * truncar el prompt sin que aparezcan los asteriscos.
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

export function RichPrompt({ content, className }: { content: string; className?: string }) {
  // Normalizamos saltos: CRLF → LF, recortamos extremos.
  const normalized = content.replace(/\r\n/g, "\n").trim()
  const paragraphs = normalized.split(/\n{2,}/)

  return (
    <div className={cn("space-y-3", className)}>
      {paragraphs.map((p, i) => (
        <p key={i} className="leading-[1.55] whitespace-pre-line">
          {renderInline(parseInline(p))}
        </p>
      ))}
    </div>
  )
}

/**
 * Devuelve el texto sin marcadores de formato. Útil para listas / tablas
 * donde queremos truncar o ordenar sin que aparezcan asteriscos.
 */
export function stripMarkdown(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
}
