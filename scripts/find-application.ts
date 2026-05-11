import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

async function main() {
  const document = process.argv[2]
  if (!document) {
    console.error("Uso: pnpm tsx --env-file=.env scripts/find-application.ts <document>")
    process.exit(1)
  }
  const apps = await p.teacherApplication.findMany({
    where: { document },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      createdAt: true,
      _count: { select: { appliedLevels: true, proposedAvailability: true } },
    },
  })
  console.log(JSON.stringify(apps, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
