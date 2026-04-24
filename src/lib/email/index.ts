import "server-only"
import { env } from "@/lib/env"
import type { EmailProvider } from "./provider"
import { ConsoleProvider } from "./console-provider"

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
    case "resend":
      // TODO: implementar ResendProvider cuando se conecte a Resend.
      // import { Resend } from 'resend'
      // class ResendProvider implements EmailProvider { ... }
      throw new Error("Resend provider no implementado todavía. Usar 'console' o activar DEMO_MODE.")
    default:
      throw new Error(`EMAIL_PROVIDER desconocido: ${env.EMAIL_PROVIDER}`)
  }
}

export type { EmailProvider, EmailMessage } from "./provider"
