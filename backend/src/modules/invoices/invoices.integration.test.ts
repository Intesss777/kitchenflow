import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { seedKitchenFlowFixtures } from '../../../scripts/kitchenflow-fixtures'
import { bootstrapDevelopmentData } from '../../../scripts/development-seed'
import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'
import type { PrivateStorageRuntime } from '../../storage'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required; run bun run test:backend:integration')

describe('purchase invoice API integration', () => {
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
        return object
          ? { key, contentLength: object.byteSize, contentType: object.contentType }
          : null
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

  test('turns a reviewed photo into stock receipts and one supplier debt entry', async () => {
    const token = await login(accounts.admin.email)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const before = await prisma.inventoryBalance.findFirstOrThrow({
      where: { product: { name: 'Лосось филе' } },
      select: { quantity: true, productId: true },
    })

    const uploadResponse = await app.request('/api/invoices/uploads', {
      method: 'POST',
      headers,
      body: JSON.stringify({ contentType: 'image/jpeg', byteSize: 1200 }),
    })
    expect(uploadResponse.status).toBe(201)
    const upload = (await uploadResponse.json()).upload

    const finalizeResponse = await app.request(`/api/invoices/${upload.uploadId}/finalize`, {
      method: 'POST',
      headers,
    })
    expect(finalizeResponse.status).toBe(200)
    const recognized = (await finalizeResponse.json()).invoice
    expect(recognized.status).toBe('review')
    expect(recognized.recognitionMode).toBe('demo')
    expect(recognized.items.length).toBeGreaterThanOrEqual(3)

    const salmon = recognized.items.find(
      (item: { productId: string | null }) => item.productId === before.productId,
    )
    expect(salmon).toBeDefined()
    const updatedQuantity = '4.250'
    const updateResponse = await app.request(`/api/invoices/${upload.uploadId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        supplierId: recognized.supplierId,
        invoiceNumber: recognized.invoiceNumber,
        invoiceDate: recognized.invoiceDate,
        dueAt: recognized.dueAt,
        items: recognized.items.map((item: Record<string, unknown>) => ({
          productId: item.productId,
          detectedName: item.detectedName,
          unit: item.unit,
          quantity: item.productId === before.productId ? updatedQuantity : item.quantity,
          unitPrice: item.unitPrice,
        })),
      }),
    })
    expect(updateResponse.status).toBe(200)
    const reviewed = (await updateResponse.json()).invoice

    const confirmResponse = await app.request(`/api/invoices/${upload.uploadId}/confirm`, {
      method: 'POST',
      headers,
    })
    expect(confirmResponse.status).toBe(200)
    expect((await confirmResponse.json()).invoice.status).toBe('confirmed')

    const after = await prisma.inventoryBalance.findUniqueOrThrow({
      where: {
        branchId_productId: {
          branchId: recognized.branchId,
          productId: before.productId,
        },
      },
      select: { quantity: true },
    })
    expect(after.quantity.minus(before.quantity).toFixed(3)).toBe(updatedQuantity)

    const ledgerEntries = await prisma.supplierLedgerEntry.findMany({
      where: { reference: reviewed.invoiceNumber },
    })
    expect(ledgerEntries).toHaveLength(1)
    expect(ledgerEntries[0]?.amount.toFixed(2)).toBe(reviewed.totalAmount)

    const repeated = await app.request(`/api/invoices/${upload.uploadId}/confirm`, {
      method: 'POST',
      headers,
    })
    expect(repeated.status).toBe(200)
    expect(await prisma.supplierLedgerEntry.count({
      where: { reference: reviewed.invoiceNumber },
    })).toBe(1)

    const archive = await app.request(
      `/api/invoices?from=${reviewed.invoiceDate}&to=${reviewed.invoiceDate}&supplierId=${reviewed.supplierId}&q=${encodeURIComponent(reviewed.invoiceNumber)}&status=confirmed&page=1&pageSize=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(archive.status).toBe(200)
    expect(await archive.json()).toMatchObject({
      invoices: [{ id: upload.uploadId, status: 'confirmed' }],
      pagination: { page: 1, pageSize: 100, total: 1, hasNext: false },
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
