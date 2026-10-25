import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { seedKitchenFlowFixtures } from '../../../scripts/kitchenflow-fixtures'
import { bootstrapDevelopmentData } from '../../../scripts/development-seed'
import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required; run bun run test:backend:integration')

describe('purchase draft API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: 'http://localhost:5173',
  })
  const prisma = createPrisma(databaseUrl)
  const app = createApp({ env, prisma })
  const accounts = {
    admin: { email: 'owner@kitchenflow.test', password: 'password123' },
    user: { email: 'chef@kitchenflow.test', password: 'password123' },
  }

  beforeEach(async () => {
    await prisma.organization.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
    const seeded = await bootstrapDevelopmentData(prisma, accounts)
    await seedKitchenFlowFixtures(prisma, {
      adminEmail: seeded.admin.email,
      userEmail: seeded.user.email,
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('shares one branch draft between chef and owner while hiding costs from the chef', async () => {
    const chefToken = await login(accounts.user.email)
    const ownerToken = await login(accounts.admin.email)
    const chefOverview = await request('/api/purchases/draft', chefToken)
    expect(chefOverview.status).toBe(200)
    const initial = await chefOverview.json()
    const cheese = initial.products.find((product: { name: string }) => product.name === 'Сыр сливочный')
    const butter = initial.products.find((product: { name: string }) => product.name === 'Масло сливочное')
    expect(initial.workspace.role).toBe('chef')
    expect(initial).not.toHaveProperty('suppliers')
    expect(initial).not.toHaveProperty('supplierId')
    expect(initial.products.every((product: { unitCost: string | null }) => product.unitCost === null)).toBe(true)

    const input = {
      note: 'Доставить до 10:00',
      items: [
        { productId: cheese.id, requestedQuantity: '3.000' },
        { productId: butter.id, requestedQuantity: '2.000' },
      ],
    }
    const saved = await request('/api/purchases/draft', chefToken, 'PUT', input)
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({
      note: input.note,
      metrics: { itemCount: 2, estimatedTotal: null },
    })

    const ownerOverview = await request('/api/purchases/draft', ownerToken)
    expect(ownerOverview.status).toBe(200)
    const ownerBody = await ownerOverview.json()
    expect(ownerBody.items).toHaveLength(2)
    expect(ownerBody.metrics.estimatedTotal).toBe('4060.00')
    expect(ownerBody.items.every((item: { lineCost: string | null }) => item.lineCost !== null)).toBe(true)

    const prepared = await request('/api/purchases/draft/prepare', chefToken, 'POST', input)
    expect(prepared.status).toBe(200)
    const preparedBody = await prepared.json()
    expect(preparedBody).not.toHaveProperty('supplierName')
    expect(preparedBody.message).toContain('Сыр сливочный — 3 кг')
    expect(preparedBody.message).not.toContain('₽')
    expect(preparedBody.message).toContain('Доставить до 10:00')
    expect(preparedBody.whatsappUrl).toStartWith('https://wa.me/?text=')

    const chefPriceAttempt = await request('/api/purchases/draft/prepare', chefToken, 'POST', {
      ...input,
      includePrices: true,
    })
    expect(chefPriceAttempt.status).toBe(200)
    expect((await chefPriceAttempt.json()).message).not.toContain('₽')

    const preparedWithPrices = await request('/api/purchases/draft/prepare', ownerToken, 'POST', {
      ...input,
      includePrices: true,
    })
    expect(preparedWithPrices.status).toBe(200)
    const pricedBody = await preparedWithPrices.json()
    expect(pricedBody.message).toContain('760 ₽')
    expect(pricedBody.message).toContain('4 060 ₽')
  })

  test('rejects products outside the active organization', async () => {
    const chefToken = await login(accounts.user.email)
    const response = await request('/api/purchases/draft', chefToken, 'PUT', {
      note: null,
      items: [{
        productId: '0199c000-0000-7000-8000-000000000098',
        requestedQuantity: '1.000',
      }],
    })
    expect(response.status).toBe(404)
  })

  async function login(email: string) {
    const response = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    })
    expect(response.status).toBe(200)
    return (await response.json()).accessToken as string
  }

  function request(path: string, token: string, method = 'GET', body?: unknown) {
    return app.request(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }
})
