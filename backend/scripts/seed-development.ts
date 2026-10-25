import 'dotenv/config'

import { createPrisma } from '../src/db'
import { seedDemoFixtures } from './demo-fixtures'
import { parseDevelopmentSeedConfig } from './development-seed-config'
import { bootstrapDevelopmentData } from './development-seed'
import { seedKitchenFlowFixtures } from './kitchenflow-fixtures'

const config = parseDevelopmentSeedConfig(process.env)
const prisma = createPrisma(config.databaseUrl)

try {
  const result = await bootstrapDevelopmentData(prisma, config.accounts)
  console.log(`Seeded development administrator ${result.admin.email}.`)
  console.log(`Seeded development user ${result.user.email}.`)
  await seedKitchenFlowFixtures(prisma, {
    adminEmail: result.admin.email,
    userEmail: result.user.email,
  })
  console.log('Seeded KitchenFlow organization, branch, suppliers, ledger, inventory, purchase draft, staff events, invoices, dish cards, and sales shift.')

  // Opt-in: `DEV_SEED_DEMO=1 bun run dev:seed` (or the screens run, through its own config).
  if (config.demo) {
    const demo = await seedDemoFixtures(prisma)
    console.log(`Seeded ${demo.count} demo fixture users.`)
  }
} finally {
  await prisma.$disconnect()
}
