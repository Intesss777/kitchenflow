import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { seedKitchenFlowFixtures } from '../../../scripts/kitchenflow-fixtures'
import { bootstrapDevelopmentData } from '../../../scripts/development-seed'
import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required; run bun run test:backend:integration')

describe('inventory API integration', () => {
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

  test('lets a chef receive, write off, and count a product without exposing its cost', async () => {
    const token = await login(accounts.user.email)
    const ownerToken = await login(accounts.admin.email)
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    const createProduct = await app.request('/api/inventory/products', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Молоко кокосовое',
        category: 'Молочные продукты',
        unit: 'liter',
        minimumQuantity: '2.000',
        unitCost: '460.00',
      }),
    })
    expect(createProduct.status).toBe(201)
    const product = (await createProduct.json()).product
    expect(product).toMatchObject({ name: 'Молоко кокосовое', unitCost: '460.00' })

    for (const movement of [
      { type: 'receipt', quantity: '10.000', unitCost: '480.00', note: 'Накладная 441' },
      { type: 'writeoff', quantity: '2.000', unitCost: null, note: 'За смену' },
      { type: 'stocktake', quantity: '6.500', unitCost: null, note: 'Вечерний пересчёт' },
    ] as const) {
      const response = await app.request(`/api/inventory/products/${product.id}/movements`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...movement,
          occurredAt: new Date().toISOString(),
          reference: null,
        }),
      })
      expect(response.status).toBe(201)
    }

    const detail = await app.request(`/api/inventory/products/${product.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(detail.status).toBe(200)
    expect(await detail.json()).toMatchObject({
      product: { id: product.id, quantity: '6.500', unitCost: null },
      movements: [
        { type: 'stocktake', quantityDelta: '-1.500', resultingQuantity: '6.500' },
        { type: 'writeoff', quantityDelta: '-2.000', resultingQuantity: '8.000' },
        { type: 'receipt', quantityDelta: '10.000', resultingQuantity: '10.000' },
      ],
    })

    const rejected = await app.request(`/api/inventory/products/${product.id}/movements`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'writeoff',
        quantity: '7.000',
        unitCost: null,
        occurredAt: new Date().toISOString(),
        reference: null,
        note: null,
      }),
    })
    expect(rejected.status).toBe(409)
  })

  test('rejects product creation by a chef', async () => {
    const token = await login(accounts.user.email)
    const response = await app.request('/api/inventory/products', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Скрытый товар',
        category: null,
        unit: 'piece',
        minimumQuantity: '1.000',
        unitCost: null,
      }),
    })

    expect(response.status).toBe(403)
  })

  test('shows inventory cost to the owner and seeded stock to both workspace roles', async () => {
    const ownerToken = await login(accounts.admin.email)
    const chefToken = await login(accounts.user.email)

    const ownerResponse = await app.request('/api/inventory', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    const chefResponse = await app.request('/api/inventory', {
      headers: { Authorization: `Bearer ${chefToken}` },
    })

    expect(ownerResponse.status).toBe(200)
    expect(chefResponse.status).toBe(200)
    const ownerBody = await ownerResponse.json()
    const chefBody = await chefResponse.json()
    expect(ownerBody.workspace).toMatchObject({ role: 'owner', branchName: 'Основной ресторан' })
    expect(ownerBody.products.length).toBeGreaterThanOrEqual(5)
    expect(ownerBody.metrics.stockValue).not.toBeNull()
    expect(ownerBody.products[0].unitCost).not.toBeNull()
    expect(chefBody.workspace.role).toBe('chef')
    expect(chefBody.metrics.stockValue).toBeNull()
    expect(chefBody.products.every((product: { unitCost: string | null }) => product.unitCost === null)).toBe(true)
  })

  test('lets an owner edit and safely archive a product', async () => {
    const token = await login(accounts.admin.email)
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    const createdResponse = await app.request('/api/inventory/products', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Тестовый товар',
        category: 'Черновики',
        unit: 'piece',
        minimumQuantity: '2.000',
        unitCost: '50.00',
      }),
    })
    const created = (await createdResponse.json()).product

    const updatedResponse = await app.request(`/api/inventory/products/${created.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: 'Тестовый товар исправленный',
        category: null,
        minimumQuantity: '3.000',
        unitCost: '55.00',
      }),
    })
    expect(updatedResponse.status).toBe(200)
    expect((await updatedResponse.json()).product).toMatchObject({
      name: 'Тестовый товар исправленный',
      category: null,
      unit: 'piece',
      minimumQuantity: '3.000',
      unitCost: '55.00',
    })

    const archivedResponse = await app.request(`/api/inventory/products/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(archivedResponse.status).toBe(200)
    expect(await archivedResponse.json()).toEqual({ archived: true })

    const overviewResponse = await app.request('/api/inventory', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const overview = await overviewResponse.json()
    expect(overview.products.some((product: { id: string }) => product.id === created.id)).toBe(false)
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
})
