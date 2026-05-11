import "server-only"
import { env } from "@/lib/env"
import type { EmailProvider } from "./provider"
import { ConsoleProvider } from "./console-provider"
import { SmtpProvider } from "./smtp-provider"

let instance: EmailProvider | null = null

/**
 * Devuelve el EmailProvider activo según `EMAIL_PROVIDER`.
 * Si DEMO_MODE=true, siempre se usa ConsoleProvider sin importar el setting.
 */
export function emailProvider(): EmailProvider {
  if (instance) return instance

  if (env.DEMO_MODE) {
    instance = new ConsoleProvider()
    return instance
  }

  switch (env.EMAIL_PROVIDER) {
    case "console":
      instance = new ConsoleProvider()
      return instance
    case "smtp":
      if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
        throw new Error("EMAIL_PROVIDER=smtp requiere SMTP_HOST, SMTP_USER y SMTP_PASSWORD")
      }
      instance = new SmtpProvider({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
        secure: env.SMTP_SECURE,
      })
      return instance
    default:
      throw new Error(`EMAIL_PROVIDER desconocido: ${env.EMAIL_PROVIDER}`)
  }
}

export type { EmailProvider, EmailMessage } from "./provider"
