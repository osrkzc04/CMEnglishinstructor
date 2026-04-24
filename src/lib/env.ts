import "server-only"
import { z } from "zod"

/**
 * Validación de variables de entorno del servidor.
 * Si falta algo crítico, la app falla al arrancar (mejor que descubrirlo en runtime).
 *
 * Para usar variables públicas (NEXT_PUBLIC_*) en el cliente, importarlas
 * directamente — Next.js las inyecta. NO usar este módulo desde Client Components.
 */

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET debe tener al menos 32 caracteres"),
  AUTH_URL: z.string().url(),

  STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default("./storage"),

  // R2 — opcionales si STORAGE_DRIVER !== 'r2'
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("CM English Instructor <no-reply@cmenglishinstructor.com>"),
  EMAIL_REPLY_TO: z.string().optional(),

  DEFAULT_TIMEZONE: z.string().default("America/Guayaquil"),

  CRON_SECRET: z.string().optional(),

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
  const r2Required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const
  const missing = r2Required.filter((k) => !env[k])
  if (missing.length > 0) {
    throw new Error(`STORAGE_DRIVER=r2 pero faltan credenciales: ${missing.join(", ")}`)
  }
}

if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY && !env.DEMO_MODE) {
  throw new Error("EMAIL_PROVIDER=resend requiere RESEND_API_KEY (o activar DEMO_MODE=true)")
}
