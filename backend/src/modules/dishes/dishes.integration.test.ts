import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { seedKitchenFlowFixtures } from '../../../scripts/kitchenflow-fixtures'
import { bootstrapDevelopmentData } from '../../../scripts/development-seed'
import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'
import type { PrivateStorageRuntime } from '../../storage'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required; run bun run test:backend:integration')

describe('dish cards API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: 'http://localhost:5173',
  })
  const prisma = createPrisma(databaseUrl)
  const stored = new Map<string, { byteSize: number; contentType: string }>()
  const deleted = new Set<string>()
  const privateStorage: PrivateStorageRuntime = {
    httpRoutes: null,
    storage: {
      driver: 'filesystem',
      async createUploadUrl(input) {
        stored.set(input.key, { byteSize: input.byteSize, contentType: input.contentType })
        return {
          key: input.key,
          method: 'PUT',
          url: `http://storage.test/${input.key}`,
          headers: { 'Content-Type': input.contentType, 'If-None-Match': '*' },
          contentLength: input.byteSize,
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        }
      },
      async createDownloadUrl({ key }) {
        return { key, url: `http://storage.test/${key}?signed=1`, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() }
      },
      async headObject(key) {
        const object = stored.get(key)
        return object ? { key, contentLength: object.byteSize, contentType: object.contentType } : null
      },
      async readRange(key) {
        return stored.has(key) ? new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]) : null
      },
      async deleteObject(key) {
        stored.delete(key)
        deleted.add(key)
      },
    },
  }
  const app = createApp({ env, prisma, privateStorage })
  const accounts = {
    admin: { email: 'owner@kitchenflow.test', password: 'password123' },
    user: { email: 'chef@kitchenflow.test', password: 'password123' },
  }

  beforeEach(async () => {
    stored.clear()
    deleted.clear()
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

  test('shows simple ingredients to both roles and financials only to the owner', async () => {
    const ownerToken = await login(accounts.admin.email)
    const chefToken = await login(accounts.user.email)
    const ownerResponse = await app.request('/api/dishes', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    const chefResponse = await app.request('/api/dishes', {
      headers: { Authorization: `Bearer ${chefToken}` },
    })

    expect(ownerResponse.status).toBe(200)
    expect(chefResponse.status).toBe(200)
    const owner = await ownerResponse.json()
    const chef = await chefResponse.json()
    expect(owner.dishes).toHaveLength(4)
    expect(owner.dishes.map((dish: { name: string }) => dish.name)).toEqual([
      'Каре ягнёнка с птитимом',
      'Лосось с брокколини',
      'Лосось с птитимом и спаржей',
      'Утиная грудка со свёклой',
    ])
    expect(owner.dishes[0]).toMatchObject({
      category: expect.any(String),
      photoUrl: expect.stringContaining('/dishes/'),
      sellingPrice: expect.any(String),
      costPrice: expect.any(String),
    })
    expect(owner.metrics.averageFoodCostPercent).toBeGreaterThan(0)
    expect(chef.dishes).toHaveLength(4)
    expect(chef.metrics.averageFoodCostPercent).toBeNull()
    expect(chef.dishes.every((dish: { sellingPrice: null; costPrice: null }) =>
      dish.sellingPrice === null && dish.costPrice === null)).toBe(true)

    const products = chef.products as Array<{ id: string; name: string }>
    const salmon = products.find((product) => product.name === 'Лосось филе')!
    const cucumber = products.find((product) => product.name === 'Огурцы свежие')!
    const createResponse = await app.request('/api/dishes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chefToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Тестовое блюдо',
        category: 'Спецпредложение',
        sellingPrice: '9999.00',
        ingredients: [
          { productId: salmon.id, quantity: '0.150' },
          { productId: cucumber.id, quantity: '0.080' },
        ],
      }),
    })
    expect(createResponse.status).toBe(201)
    const created = (await createResponse.json()).dish
    expect(created).toMatchObject({ name: 'Тестовое блюдо', sellingPrice: null, costPrice: null })

    const ownerAfter = await app.request('/api/dishes', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    const ownerCreated = (await ownerAfter.json()).dishes.find(
      (dish: { id: string }) => dish.id === created.id,
    )
    expect(ownerCreated.sellingPrice).toBeNull()
    expect(ownerCreated.costPrice).toBe('232.70')

    const firstUpload = await app.request(`/api/dishes/${created.id}/photo/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chefToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'image/jpeg', byteSize: 2048 }),
    })
    expect(firstUpload.status).toBe(201)
    const firstTicket = (await firstUpload.json()).upload
    const firstFinalize = await app.request(
      `/api/dishes/${created.id}/photo/uploads/${firstTicket.uploadId}/finalize`,
      { method: 'POST', headers: { Authorization: `Bearer ${chefToken}` } },
    )
    expect(firstFinalize.status).toBe(200)
    expect((await firstFinalize.json()).dish.photoUrl).toContain('http://storage.test/dish-photos/')

    const firstKey = [...stored.keys()][0]!
    const secondUpload = await app.request(`/api/dishes/${created.id}/photo/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chefToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'image/jpeg', byteSize: 4096 }),
    })
    const secondTicket = (await secondUpload.json()).upload
    const secondFinalize = await app.request(
      `/api/dishes/${created.id}/photo/uploads/${secondTicket.uploadId}/finalize`,
      { method: 'POST', headers: { Authorization: `Bearer ${chefToken}` } },
    )
    expect(secondFinalize.status).toBe(200)
    expect(deleted.has(firstKey)).toBe(true)
    expect(stored.size).toBe(1)
  })

  test('returns an actionable Russian error when a chef reuses a dish name', async () => {
    const chefToken = await login(accounts.user.email)
    const overviewResponse = await app.request('/api/dishes', {
      headers: { Authorization: `Bearer ${chefToken}` },
    })
    const overview = await overviewResponse.json()
    const productId = overview.products[0].id as string

    const response = await app.request('/api/dishes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chefToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Каре ягнёнка с птитимом',
        category: 'Горячее',
        sellingPrice: null,
        ingredients: [{ productId, quantity: '0.100' }],
      }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: { message: 'Блюдо с таким названием уже существует' },
    })
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
