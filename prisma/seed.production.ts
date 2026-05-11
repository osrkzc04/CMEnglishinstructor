/**
 * Seed de PRODUCCIÓN.
 * ----------------------------------------------------------------------------
 * Pensado para correr en el entrypoint del contenedor de Dokploy. Es
 * idempotente — cada arranque verifica la presencia de los datos mínimos:
 *
 *   - Idiomas + niveles CEFR
 *   - Catálogo académico (Course / Program / ProgramLevel)
 *   - Configuración global (AppSetting)
 *   - Feriados del año
 *   - Super administrador (DIRECTOR) tomado de variables de entorno
 *
 * NO inserta datos demo (usuarios de ejemplo, postulaciones, estudiantes
 * placebo, banco de preguntas, plantillas de prueba). Esos viven sólo en
 * `prisma/seed.ts`.
 *
 * Variables de entorno requeridas en el primer arranque:
 *   - SUPER_ADMIN_EMAIL        (obligatorio)
 *   - SUPER_ADMIN_PASSWORD     (obligatorio)
 *   - SUPER_ADMIN_FIRST_NAME   (opcional — default "Director")
 *   - SUPER_ADMIN_LAST_NAME    (opcional — default "Principal")
 *   - SUPER_ADMIN_DOCUMENT     (opcional)
 *   - SUPER_ADMIN_PHONE        (opcional)
 *
 * Ejecución:
 *   pnpm db:seed:prod
 */

import { PrismaClient } from "@prisma/client"
import { seedCatalog } from "./seed/catalog"
import { seedSettings } from "./seed/settings"
import { seedHolidays } from "./seed/holidays"
import { readSuperAdminFromEnv, seedSuperAdmin } from "./seed/super-admin"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seed de producción — bootstrap mínimo")

  const adminData = readSuperAdminFromEnv()

  // 1. Catálogo + CEFR primero (no depende de nadie).
  await seedCatalog(prisma)
  console.log("  ✓ Catálogo + CEFR")

  // 2. Super admin a continuación (proveerá el auditing de los settings/holidays).
  const directorId = await seedSuperAdmin(prisma, adminData)
  console.log(`  ✓ Super admin (${adminData.email})`)

  // 3. Settings + feriados.
  await seedSettings(prisma, directorId)
  console.log("  ✓ Configuración global")
  await seedHolidays(prisma, directorId)
  console.log("  ✓ Feriados")

  console.log("✅ Seed de producción completo")
}

main()
  .catch((e) => {
    console.error("❌ Error en seed de producción:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
