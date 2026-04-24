import "server-only"
import type { EmailMessage, EmailProvider } from "./provider"

/**
 * Email provider para desarrollo y demo.
 * Imprime el contenido del email en logs en lugar de enviarlo.
 */
export class ConsoleProvider implements EmailProvider {
  async send(msg: EmailMessage) {
    const id = `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    console.log("\n" + "═".repeat(70))
    console.log("📧 EMAIL (console provider — no se envió realmente)")
    console.log("─".repeat(70))
    console.log(`From:    ${msg.from ?? "default"}`)
    console.log(`To:      ${msg.to}`)
    if (msg.cc) console.log(`Cc:      ${msg.cc}`)
    console.log(`Subject: ${msg.subject}`)
    console.log("─".repeat(70))
    console.log(stripHtml(msg.html).slice(0, 800))
    if (msg.html.length > 800) console.log("... (truncado)")
    console.log("═".repeat(70) + "\n")
    return { id }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
