import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

async function main() {
  const start = Date.now()
  const result = await p.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`
  const ms = Date.now() - start
  console.log(`✓ DB respondió en ${ms} ms — resultado:`, result)
}

main()
  .catch((err) => {
    console.error("✗ Error conectando:", err.message)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
