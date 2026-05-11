import "server-only"
import { z } from "zod"

/**
 * Validación de variables de entorno del servidor.
 * Si falta algo crítico, la app falla al arrancar (mejor que descubrirlo en runtime).
 *
 * Para usar variables públicas (NEXT_PUBLIC_*) en el cliente, importarlas
 * directamente — Next.js las inyecta. NO usar este módulo desde Client Components.
 */

// Detectamos la fase de build de Next (`next build`) para relajar los checks
// estrictos. Durante "Collecting page data", Next evalúa los route handlers
// que terminan importando este módulo — sin AUTH_SECRET/DATABASE_URL reales
// el build fallaría. En runtime las vars vienen del orquestador (Dokploy) y
// el schema vuelve a su modo estricto.
//
// Esto también evita meter placeholders en el Dockerfile que dispararían
// la alerta "SecretsUsedInArgOrEnv" de scanners como Hadolint/Snyk/Trivy.
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_BUILD === "1"

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: isBuildPhase
    ? z.string().url().default("postgresql://build:build@localhost:5432/build")
    : z.string().url(),

  AUTH_SECRET: isBuildPhase
    ? z.string().default("build_time_placeholder_secret_at_least_32_characters_long")
    : z.string().min(32, "AUTH_SECRET debe tener al menos 32 caracteres"),
  AUTH_URL: isBuildPhase ? z.string().url().default("http://localhost:3000") : z.string().url(),

  STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default("./storage"),

  // R2 — opcionales si STORAGE_DRIVER !== 'r2'
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  EMAIL_FROM: z
    .string()
    .default("CM English Instructor <no-reply@cmenglishinstructor.com>")
    .refine((v) => /@/.test(v), {
      message:
        "EMAIL_FROM debe incluir un email — formato 'Nombre <correo@dominio>' (Gmail rechaza headers sin email por RFC 5322)",
    }),
  EMAIL_REPLY_TO: z.string().optional(),

  DEFAULT_TIMEZONE: z.string().default("America/Guayaquil"),

  CRON_SECRET: z.string().optional(),

  // Cloudflare Turnstile — captcha del form público de postulaciones.
  // Si no se setean, la verificación se omite (útil en dev) y queda solo
  // el rate-limit por IP/email.
  TURNSTILE_SECRET_KEY: z.string().optional(),

  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
})

const parsed = ServerEnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:")
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error("Configuración de entorno inválida. Ver mensajes arriba.")
}

export const env = parsed.data

/**
 * Validación adicional condicional: si STORAGE_DRIVER=r2, las credenciales son obligatorias.
 */
if (env.STORAGE_DRIVER === "r2") {
  const r2Required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ] as const
  const missing = r2Required.filter((k) => !env[k])
  if (missing.length > 0) {
    throw new Error(`STORAGE_DRIVER=r2 pero faltan credenciales: ${missing.join(", ")}`)
  }
}

if (env.EMAIL_PROVIDER === "smtp" && !env.DEMO_MODE) {
  const smtpRequired = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const
  const missing = smtpRequired.filter((k) => !env[k])
  if (missing.length > 0) {
    throw new Error(
      `EMAIL_PROVIDER=smtp requiere: ${missing.join(", ")} (o activar DEMO_MODE=true)`,
    )
  }
}
