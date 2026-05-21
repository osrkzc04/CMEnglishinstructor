/**
 * Shell editorial compartido para todos los emails transaccionales.
 *
 * Sin `server-only` — la función es pura (string in, string out) y no toca
 * env, DB ni secrets, así que es seguro importarla desde un script tsx
 * (preview-email.ts) o tests sin atravesar el guard.
 *
 * Constraints de email rendering (no opinables):
 *   - Layout en `<table>` — Outlook usa Word como engine y rompe `<div>`s
 *     con padding/border; tablas son la única forma robusta.
 *   - Estilos inline — Gmail elimina `<style>` cuando reenvía; muchos
 *     proxies cortan los stylesheets remotos.
 *   - Sin web fonts — Geist y Fraunces no llegan al cliente. Caemos a
 *     Georgia (serif) y Arial/Helvetica (sans), que son los más cercanos
 *     visualmente y están en todos los sistemas.
 *   - Ancho 560 px — caben en ventana móvil (≤600 px) y en desktop sin
 *     verse demasiado anchos.
 *   - SVGs evitados — Outlook clásico no los renderiza; el wordmark va en
 *     texto puro con un punto teal como marca de color.
 *
 * Identidad: el resto del producto es editorial premium (CLAUDE.md). El
 * email replica la idea con tipografía serif, espacios generosos, una sola
 * línea de acento (teal) y un footer discreto. Nada de gradientes, sombras
 * o ilustraciones.
 */

export const EMAIL_COLORS = {
  ink: "#233641",
  inkInverse: "#FAF8F5",
  body: "#3E4F58",
  textMuted: "#62737B",
  textFaded: "#8FA0A8",
  border: "#EAECED",
  bone: "#FAF8F5",
  teal: "#279F89",
  white: "#FFFFFF",
} as const

export const EMAIL_FONTS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'SFMono-Regular', Menlo, Consolas, monospace",
} as const

// Aliases internos para no tocar las plantillas existentes.
const COLORS = EMAIL_COLORS
const FONT_SERIF = EMAIL_FONTS.serif
const FONT_SANS = EMAIL_FONTS.sans
const FONT_MONO = EMAIL_FONTS.mono

/**
 * Bloque mixto del body. Permite intercalar HTML arbitrario (tablas, cards,
 * separadores) entre párrafos sin romper el shell. Usar `kind: "raw"` solo
 * para HTML que viene de fuentes internas — no llega a escapado.
 */
export type EmailBlock = { kind: "p"; html: string } | { kind: "raw"; html: string }

export type EmailRenderOpts = {
  /** Texto oculto que aparece en la preview del inbox. Recomendado. */
  preheader?: string
  /** Etiqueta pequeña uppercase encima del heading (ej. "CONFIRMACIÓN"). */
  eyebrow?: string
  /** Heading principal en serif. Usar saludos cortos: "Hola, Oscar". */
  heading: string
  /**
   * Párrafos del body, en orden. Cada elemento es un `<p>`. Conserva
   * compatibilidad con los emails más simples; si necesitas un bloque
   * arbitrario (ej. tabla de horario) usá `blocks` en su lugar.
   */
  body?: string[]
  /**
   * Bloques heterogéneos. Si se pasa, sustituye a `body`. Cada bloque puede
   * ser un párrafo (`kind: "p"`) — equivalente a una entrada de `body[]` —
   * o HTML crudo (`kind: "raw"`) que se inserta tal cual entre los
   * elementos del card. Útil para tablas que no caben dentro de un `<p>`.
   */
  blocks?: EmailBlock[]
  /** Botón principal. Si se omite, no se renderiza ni el fallback de URL. */
  cta?: { label: string; url: string }
  /**
   * Texto fino debajo del CTA (o al final si no hay CTA). Pensado para
   * "este enlace expira en X horas" o instrucciones de soporte.
   */
  fineprint?: string
}

export function renderEmail(opts: EmailRenderOpts): string {
  const { preheader, eyebrow, heading, body, blocks, cta, fineprint } = opts

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bone};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${preheader ? renderPreheader(preheader) : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bone};">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        ${renderHeader()}
        ${renderCard({ eyebrow, heading, body, blocks, cta, fineprint })}
        ${renderFooter()}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

// -----------------------------------------------------------------------------
//  Bloques
// -----------------------------------------------------------------------------

function renderPreheader(text: string): string {
  // Truco estándar: invisible para el ojo, pero los clientes lo leen como
  // preview en la lista del inbox. Padding con espacios no-rompibles para
  // empujar fuera del preview el contenido del párrafo siguiente.
  const padding = "&#847; ".repeat(60)
  return `<div style="display:none;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:${COLORS.bone};">${escapeHtml(text)}${padding}</div>`
}

function renderHeader(): string {
  return `<tr>
  <td style="padding:0 4px 28px 4px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align:middle;padding-right:10px;font-size:0;line-height:0;">
          <span style="display:inline-block;width:7px;height:7px;background:${COLORS.teal};border-radius:50%;"></span>
        </td>
        <td style="vertical-align:middle;font-family:${FONT_SERIF};font-style:italic;font-size:17px;line-height:1;color:${COLORS.ink};letter-spacing:-0.005em;">
          CM<span style="color:${COLORS.textFaded};padding:0 4px;">·</span>English Instructor
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

function renderCard(opts: {
  eyebrow?: string
  heading: string
  body?: string[]
  blocks?: EmailBlock[]
  cta?: { label: string; url: string }
  fineprint?: string
}): string {
  const { eyebrow, heading, body, blocks, cta, fineprint } = opts

  // `blocks` gana si está presente. Si no, caemos a `body` (compat con
  // emails simples). Si ninguno se pasa, el card queda sin cuerpo.
  const bodyHtml = blocks
    ? blocks.map(renderBlock).join("\n    ")
    : body
      ? body.map(renderParagraph).join("\n    ")
      : ""

  return `<tr>
  <td style="background:${COLORS.white};border:1px solid ${COLORS.border};border-radius:14px;padding:44px 40px;">
    ${eyebrow ? renderEyebrow(eyebrow) : ""}
    <h1 style="margin:0 0 20px 0;font-family:${FONT_SERIF};font-size:28px;font-weight:400;line-height:1.2;letter-spacing:-0.015em;color:${COLORS.ink};">
      ${escapeHtml(heading)}
    </h1>
    ${bodyHtml}
    ${cta ? renderCta(cta) : ""}
    ${fineprint ? renderFineprint(fineprint) : ""}
  </td>
</tr>`
}

function renderBlock(block: EmailBlock): string {
  if (block.kind === "p") return renderParagraph(block.html)
  return block.html
}

function renderEyebrow(text: string): string {
  return `<p style="margin:0 0 18px 0;font-family:${FONT_SANS};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.teal};">
      ${escapeHtml(text)}
    </p>`
}

function renderParagraph(text: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT_SANS};font-size:15px;line-height:1.65;color:${COLORS.body};">
      ${text}
    </p>`
}

function renderCta(cta: { label: string; url: string }): string {
  // Wrapper en `<table>` con bg de color: si el cliente no soporta
  // border-radius en el `<a>`, el botón sigue siendo un rectángulo sólido
  // legible. El href escapado va al `<a>`; el `<table>` da el color.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 24px 0;">
      <tr>
        <td style="background:${COLORS.ink};border-radius:9px;">
          <a href="${escapeAttr(cta.url)}" style="display:inline-block;padding:14px 26px;font-family:${FONT_SANS};font-size:14.5px;font-weight:500;color:${COLORS.inkInverse};text-decoration:none;letter-spacing:-0.005em;border-radius:9px;">
            ${escapeHtml(cta.label)}
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 6px 0;font-family:${FONT_SANS};font-size:12px;line-height:1.55;color:${COLORS.textFaded};">
      Si el botón no funciona, copia este enlace en tu navegador:
    </p>
    <p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:11.5px;line-height:1.5;color:${COLORS.textMuted};word-break:break-all;">
      ${escapeHtml(cta.url)}
    </p>`
}

function renderFineprint(text: string): string {
  return `<p style="margin:28px 0 0 0;padding-top:22px;border-top:1px solid ${COLORS.border};font-family:${FONT_SANS};font-size:13px;line-height:1.6;color:${COLORS.textMuted};">
      ${escapeHtml(text)}
    </p>`
}

function renderFooter(): string {
  return `<tr>
  <td style="padding:32px 12px 0 12px;text-align:center;">
    <p style="margin:0 0 6px 0;font-family:${FONT_SERIF};font-style:italic;font-size:13.5px;color:${COLORS.body};letter-spacing:-0.005em;">
      CM Language Center
    </p>
    <p style="margin:0 0 14px 0;font-family:${FONT_SANS};font-size:12px;line-height:1.55;color:${COLORS.textFaded};">
      Instrucción de inglés y español para empresas, ejecutivos, adolescentes y niños
    </p>
    <p style="margin:0;font-family:${FONT_SANS};font-size:11.5px;color:${COLORS.textFaded};">
      <a href="mailto:coordinacion@cmenglishinstructor.com" style="color:${COLORS.textMuted};text-decoration:none;">coordinacion@cmenglishinstructor.com</a>
    </p>
  </td>
</tr>`
}

// -----------------------------------------------------------------------------
//  Escapado
// -----------------------------------------------------------------------------

/**
 * Sanitiza texto que va dentro de un nodo HTML. NO usar para URLs en
 * `href` — para eso está `escapeAttr` (sólo cubre los caracteres que el
 * parser de atributo trata especial).
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
}
