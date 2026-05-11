import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

async function main() {
  const id = process.argv[2]
  if (!id) {
    console.error("Uso: pnpm tsx --env-file=.env scripts/delete-application.ts <id>")
    process.exit(1)
  }

  const before = await p.teacherApplication.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      _count: { select: { appliedLevels: true, proposedAvailability: true } },
    },
  })
  if (!before) {
    console.error(`No existe postulación con id ${id}`)
    process.exit(2)
  }
  console.log("Borrando:", JSON.stringify(before, null, 2))

  await p.teacherApplication.delete({ where: { id } })
  console.log("✓ Postulación eliminada (levels y availability cascadearon).")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
