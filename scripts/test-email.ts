/**
 * Smoke test del SMTP. Manda un correo de prueba al destinatario que
 * pases como argumento.
 *
 * Uso:
 *   pnpm tsx --env-file=.env scripts/test-email.ts oscar@example.com
 *
 * NB: instanciamos nodemailer directo en este script para evitar el
 * `import "server-only"` de los módulos del runtime (que bloquea la carga
 * fuera de un Server Component).
 */

import nodemailer from "nodemailer"

async function main() {
  const to = process.argv[2] ?? process.env.TEST_EMAIL_TO
  if (!to) {
    console.error("Falta destinatario:")
    console.error("  pnpm tsx --env-file=.env scripts/test-email.ts <email>")
    process.exit(1)
  }

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  const secure = process.env.SMTP_SECURE === "true"
  const from =
    process.env.EMAIL_FROM ??
    "CM English Instructor <no-reply@cmenglishinstructor.com>"
  const replyTo = process.env.EMAIL_REPLY_TO

  if (!host || !user || !password) {
    console.error("Falta alguna variable SMTP_* en el .env:")
    console.error("  SMTP_HOST    =", host ?? "(faltante)")
    console.error("  SMTP_USER    =", user ?? "(faltante)")
    console.error("  SMTP_PASSWORD=", password ? "(set)" : "(faltante)")
    process.exit(2)
  }

  console.log("─".repeat(60))
  console.log("Host:    ", host)
  console.log("Port:    ", port)
  console.log("User:    ", user)
  console.log("Secure:  ", secure)
  console.log("From:    ", from)
  console.log("Reply-To:", replyTo ?? "(no set)")
  console.log("To:      ", to)
  console.log("─".repeat(60))

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
  })

  // Verifica primero la conexión y autenticación. Errores comunes:
  //   - ECONNREFUSED / ETIMEDOUT → host/puerto incorrecto, firewall.
  //   - EAUTH → user/password mal o el panel exige password de aplicación.
  //   - ESOCKET / SSL/TLS error → SMTP_SECURE mal seteado para el puerto.
  try {
    console.log("→ Verificando conexión SMTP…")
    await transporter.verify()
    console.log("✓ Conexión y autenticación OK")
  } catch (err) {
    console.error("\n✗ verify() falló:")
    console.error(err)
    process.exit(3)
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:40px 16px;background:#FAF8F5;font-family:Arial,Helvetica,sans-serif;color:#233641;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center">
      <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1px solid #EAECED;border-radius:12px;padding:40px;max-width:520px;">
        <tr><td>
          <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:-0.01em;margin:0 0 12px 0;color:#233641;">
            Prueba de envío
          </h1>
          <p style="font-size:14px;line-height:1.6;color:#3E4F58;margin:0 0 12px 0;">
            Este es un correo de prueba enviado desde el SMTP del dominio configurado en CM English Instructor.
          </p>
          <p style="font-size:13px;line-height:1.6;color:#62737B;margin:0;">
            Si llegó, la configuración funciona. Hora del envío: ${new Date().toISOString()}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    console.log("\n→ Enviando…")
    const info = await transporter.sendMail({
      from,
      replyTo,
      to,
      subject: "Prueba SMTP — CM English Instructor",
      html,
    })
    console.log("\n✓ Enviado.")
    console.log("  messageId:", info.messageId)
    if (info.response) console.log("  response: ", info.response)
    if (info.accepted?.length)
      console.log("  accepted: ", info.accepted.join(", "))
    if (info.rejected?.length)
      console.log("  rejected: ", info.rejected.join(", "))
  } catch (err) {
    console.error("\n✗ Falló el envío:")
    console.error(err)
    process.exit(4)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
