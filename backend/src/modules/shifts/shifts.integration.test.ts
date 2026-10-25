import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { seedKitchenFlowFixtures } from '../../../scripts/kitchenflow-fixtures'
import { bootstrapDevelopmentData } from '../../../scripts/development-seed'
import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'
import type { PrivateStorageRuntime } from '../../storage'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required; run bun run test:backend:integration')

describe('sales shift API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: 'http://localhost:5173',
  })
  const prisma = createPrisma(databaseUrl)
  const stored = new Map<string, { byteSize: number; contentType: string }>()
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
        return {
          key,
          url: `http://storage.test/${key}?signed=1`,
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        }
      },
      async headObject(key) {
        const object = stored.get(key)
        return object ? { key, contentLength: object.byteSize, contentType: object.contentType } : null
      },
      async readRange(key) {
        return stored.has(key)
          ? new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
          : null
      },
      async deleteObject(key) {
        stored.delete(key)
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

  test('aggregates receipt photos, reviews dishes, and writes ingredients off once', async () => {
    const token = await login(accounts.user.email)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    let shiftId = ''

    for (const byteSize of [1200, 1300]) {
      const uploadResponse = await app.request('/api/shifts/uploads', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shiftDate: '2026-10-11',
          contentType: 'image/jpeg',
          byteSize,
        }),
      })
      expect(uploadResponse.status).toBe(201)
      const body = await uploadResponse.json()
      shiftId = body.shiftId
      const finalizeResponse = await app.request(`/api/shifts/receipts/${body.upload.uploadId}/finalize`, {
        method: 'POST',
        headers,
      })
      expect(finalizeResponse.status).toBe(200)
    }

    const detailResponse = await app.request(`/api/shifts/${shiftId}`, { headers })
    expect(detailResponse.status).toBe(200)
    const draft = (await detailResponse.json()).shift
    expect(draft.receipts).toHaveLength(2)
    expect(draft.lines.length).toBeGreaterThan(0)
    expect(draft.consumption.length).toBeGreaterThan(0)

    const salmonWithPtitim = await prisma.dishCard.findFirstOrThrow({
      where: { name: 'Лосось с птитимом и спаржей' },
      select: { id: true },
    })
    const salmon = await prisma.inventoryProduct.findFirstOrThrow({
      where: { name: 'Лосось филе' },
      select: { id: true, balances: { take: 1, select: { quantity: true } } },
    })
    const before = salmon.balances[0]!.quantity

    const updateResponse = await app.request(`/api/shifts/${shiftId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ lines: [{ dishId: salmonWithPtitim.id, quantity: 2 }] }),
    })
    expect(updateResponse.status).toBe(200)
    expect((await updateResponse.json()).shift.consumption).toContainEqual(expect.objectContaining({
      productId: salmon.id,
      quantityUsed: '0.360',
    }))

    const confirmResponse = await app.request(`/api/shifts/${shiftId}/confirm`, {
      method: 'POST',
      headers,
    })
    expect(confirmResponse.status).toBe(200)
    expect((await confirmResponse.json()).shift.status).toBe('confirmed')

    const after = await prisma.inventoryBalance.findFirstOrThrow({
      where: { productId: salmon.id },
      select: { quantity: true },
    })
    expect(before.minus(after.quantity).toFixed(3)).toBe('0.360')
    expect(await prisma.inventoryMovement.count({ where: { salesShiftId: shiftId } })).toBe(6)

    const repeated = await app.request(`/api/shifts/${shiftId}/confirm`, {
      method: 'POST',
      headers,
    })
    expect(repeated.status).toBe(200)
    expect(await prisma.inventoryMovement.count({ where: { salesShiftId: shiftId } })).toBe(6)
  })

  test('does not expose a shift from another active branch in the same organization', async () => {
    const token = await login(accounts.user.email)
    const membership = await prisma.organizationMembership.findFirstOrThrow({
      where: { user: { email: accounts.user.email } },
      select: { organizationId: true, userId: true },
    })
    const otherBranch = await prisma.branch.create({
      data: { organizationId: membership.organizationId, name: 'Веранда' },
    })
    const otherShift = await prisma.salesShift.create({
      data: {
        organizationId: membership.organizationId,
        branchId: otherBranch.id,
        createdByUserId: membership.userId,
        shiftDate: new Date('2026-10-10T00:00:00.000Z'),
      },
    })

    const response = await app.request(`/api/shifts/${otherShift.id}`, {
      headers: { Authorization: `Bearer ${token}` },
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
})
