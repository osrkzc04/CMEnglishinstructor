import "server-only"

/**
 * Interfaz abstracta del proveedor de email.
 * Implementaciones: ConsoleProvider (dev), ResendProvider (prod).
 */

export interface EmailMessage {
  to: string
  cc?: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<{ id: string }>
}
