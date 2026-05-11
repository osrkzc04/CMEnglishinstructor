import "server-only"
import nodemailer, { type Transporter } from "nodemailer"
import type { EmailMessage, EmailProvider } from "./provider"

/**
 * Email provider para producción vía SMTP del dominio (cualquier hosting
 * con servidor de correo: cPanel, Plesk, VPS, etc.).
 *
 * Variables esperadas: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
 * `SMTP_PASSWORD`, `SMTP_SECURE`. Si `SMTP_SECURE=true`, usa TLS implícito
 * (puerto 465). Si es false, hace STARTTLS (puerto 587, recomendado por la
 * mayoría de hosts modernos).
 */
export type SmtpConfig = {
  host: string
  port: number
  user: string
  password: string
  secure: boolean
}

export class SmtpProvider implements EmailProvider {
  private transporter: Transporter

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    })
  }

  async send(msg: EmailMessage): Promise<{ id: string }> {
    if (!msg.from) {
      throw new Error("SmtpProvider requiere `from` (configurado vía EMAIL_FROM).")
    }
    if (!/@/.test(msg.from)) {
      throw new Error(
        `EMAIL_FROM no contiene un email válido: "${msg.from}". Formato esperado: 'Nombre <correo@dominio>'.`,
      )
    }
    const info = await this.transporter.sendMail({
      from: msg.from,
      to: msg.to,
      cc: msg.cc,
      replyTo: msg.replyTo,
      subject: msg.subject,
      html: msg.html,
    })
    return { id: info.messageId }
  }
}
