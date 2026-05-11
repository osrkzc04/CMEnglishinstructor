/**
 * Genera un .html con cada plantilla para revisar el render en el navegador.
 *
 * Uso:
 *   pnpm tsx --env-file=.env scripts/preview-email.ts
 *   open ./tmp/email-*.html
 */

import { writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { renderEmail } from "../src/lib/email/template"

const OUT_DIR = join(process.cwd(), "tmp")

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const samples = [
    {
      file: "email-activation.html",
      html: renderEmail({
        preheader: "Define tu contraseña para activar tu cuenta.",
        eyebrow: "Activación de cuenta",
        heading: "Hola, Oscar",
        body: [
          "Tu cuenta en CM English Instructor está lista. Para entrar por primera vez, define tu contraseña con el siguiente enlace.",
        ],
        cta: {
          label: "Activar cuenta",
          url: "https://cmenglishinstructor.com/activar/abc123def456ghi789",
        },
        fineprint:
          "Este enlace vence en 7 días. Si no esperabas este correo, puedes ignorarlo sin que pase nada.",
      }),
    },
    {
      file: "email-reset.html",
      html: renderEmail({
        preheader: "Restablece la contraseña de tu cuenta.",
        eyebrow: "Restablecer contraseña",
        heading: "Hola, Carolina",
        body: [
          "Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, usa el siguiente enlace para crear una nueva.",
        ],
        cta: {
          label: "Restablecer contraseña",
          url: "https://cmenglishinstructor.com/recuperar/xyz789uvw456",
        },
        fineprint:
          "Este enlace vence en 1 hora. Si no solicitaste el cambio, puedes ignorar este correo — tu contraseña actual seguirá funcionando.",
      }),
    },
    {
      file: "email-deactivation.html",
      html: renderEmail({
        preheader: "Tu acceso a la plataforma fue desactivado.",
        eyebrow: "Acceso desactivado",
        heading: "Hola, Oscar",
        body: [
          "Te avisamos que tu acceso a la plataforma de CM English Instructor fue desactivado. Mientras tu cuenta esté en este estado, no podrás iniciar sesión.",
          "Si crees que es un error o quieres retomar tus clases, escríbenos respondiendo a este correo y lo revisamos.",
        ],
        fineprint:
          "Tu información queda preservada — si reactivamos la cuenta, todo vuelve a estar disponible donde lo dejaste.",
      }),
    },
    {
      file: "email-application.html",
      html: renderEmail({
        preheader: "Gracias por postular. Vamos a revisar tu perfil y te contactamos pronto.",
        eyebrow: "Postulación recibida",
        heading: "Hola, Oscar",
        body: [
          "Recibimos tu postulación para sumarte como instructor en CM English Instructor. Gracias por tomarte el tiempo de contarnos sobre tu experiencia.",
          "Vamos a revisarla con calma y, si tu perfil coincide con lo que estamos buscando, te escribimos para coordinar una entrevista. El proceso suele tomarnos entre 5 y 10 días hábiles.",
        ],
        fineprint:
          "Este es un correo automático — no es necesario responder. Si necesitas comunicarte con nosotros, escríbenos a coordinacion@cmenglishinstructor.com.",
      }),
    },
  ]

  for (const s of samples) {
    const path = join(OUT_DIR, s.file)
    await writeFile(path, s.html, "utf8")
    console.log(`✓ ${path}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
