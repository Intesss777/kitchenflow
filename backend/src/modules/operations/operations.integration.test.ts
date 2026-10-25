import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { seedKitchenFlowFixtures } from '../../../scripts/kitchenflow-fixtures'
import { bootstrapDevelopmentData } from '../../../scripts/development-seed'
import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required; run bun run test:backend:integration')

describe('operations dashboard API integration', () => {
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

  test('returns supplier debt and recent ledger activity for the owner workspace', async () => {
    const token = await login(accounts.admin.email)
    const today = new Date().toISOString().slice(0, 10)
    await prisma.salesShift.updateMany({ data: { status: 'confirmed' } })
    const response = await app.request(`/api/operations/dashboard?from=${today}&to=${today}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      workspace: {
        organizationName: 'KitchenFlow Demo',
        branchName: 'Основной ресторан',
      },
      metrics: {
        supplierDebt: '293700.00',
        activeSuppliers: 3,
        overdueSuppliers: 1,
      },
    })
    expect(body.suppliers).toHaveLength(3)
    expect(body.recentEntries).toHaveLength(5)
    expect(body.activity).toHaveLength(7)
    expect(body.analytics).toMatchObject({
      range: { from: today, to: today, granularity: 'day' },
      totals: { confirmedShifts: 1, dishesSold: 36 },
    })
    expect(Number(body.analytics.totals.revenue)).toBeGreaterThan(0)
    expect(Number(body.analytics.totals.foodCost)).toBeGreaterThan(0)
    expect(body.analytics.series).toHaveLength(1)
    expect(body.suppliers.find((supplier: { name: string }) => supplier.name === 'Фреш Маркет'))
      .toMatchObject({ balance: '46340.00', isOverdue: true })
  })

  test('rejects an inverted dashboard range', async () => {
    const token = await login(accounts.admin.email)
    const response = await app.request(
      '/api/operations/dashboard?from=2026-10-14&to=2026-10-01',
      { headers: { Authorization: `Bearer ${token}` } },
    )

    expect(response.status).toBe(400)
  })

  test('keeps the owner financial dashboard hidden from the chef role', async () => {
    const token = await login(accounts.user.email)
    const response = await app.request('/api/operations/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe('FORBIDDEN')
  })

  test('lets the owner add a supplier, record an invoice and payment, and read the ledger', async () => {
    const token = await login(accounts.admin.email)
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    const createSupplier = await app.request('/api/operations/suppliers', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Фермерское хозяйство',
        legalName: 'ИП Петров Олег Сергеевич',
        taxId: '771234567890',
        registrationReasonCode: null,
        registrationNumber: '325770000123456',
        legalAddress: 'Москва, ул. Полевая, 7',
        bankName: 'АО «Банк»',
        bankBik: '044525000',
        correspondentAccount: '30101810000000000000',
        settlementAccount: '40802810000000000000',
        contactName: 'Олег',
        phone: '+7 900 000-00-00',
        whatsappPhone: '79000000000',
        paymentTermsDays: 7,
      }),
    })
    expect(createSupplier.status).toBe(201)
    const supplier = (await createSupplier.json()).supplier

    const updateSupplier = await app.request(`/api/operations/suppliers/${supplier.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: 'Фермерское хозяйство',
        legalName: 'ИП Петров Олег Сергеевич',
        taxId: '771234567890',
        registrationReasonCode: null,
        registrationNumber: '325770000123456',
        legalAddress: 'Москва, ул. Полевая, 7',
        bankName: 'АО «Новый банк»',
        bankBik: '044525000',
        correspondentAccount: '30101810000000000000',
        settlementAccount: '40802810000000000000',
        contactName: 'Олег',
        phone: '+7 900 000-00-00',
        whatsappPhone: '79000000000',
        paymentTermsDays: 7,
      }),
    })
    expect(updateSupplier.status).toBe(200)
    expect((await updateSupplier.json()).supplier.bankName).toBe('АО «Новый банк»')

    const invoice = await app.request(`/api/operations/suppliers/${supplier.id}/entries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'invoice',
        amount: '12000.00',
        occurredAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        reference: 'ФХ-101',
        note: 'Сыры и молочная продукция',
      }),
    })
    expect(invoice.status).toBe(201)

    const payment = await app.request(`/api/operations/suppliers/${supplier.id}/entries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'payment',
        amount: '2500.00',
        occurredAt: new Date().toISOString(),
        dueAt: null,
        reference: null,
        note: 'Частичная оплата',
      }),
    })
    expect(payment.status).toBe(201)

    const detail = await app.request(`/api/operations/suppliers/${supplier.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(detail.status).toBe(200)
    expect(await detail.json()).toMatchObject({
      supplier: {
        id: supplier.id,
        name: 'Фермерское хозяйство',
        legalName: 'ИП Петров Олег Сергеевич',
        taxId: '771234567890',
        registrationReasonCode: null,
        registrationNumber: '325770000123456',
        legalAddress: 'Москва, ул. Полевая, 7',
        bankName: 'АО «Новый банк»',
        bankBik: '044525000',
        correspondentAccount: '30101810000000000000',
        settlementAccount: '40802810000000000000',
        balance: '9500.00',
      },
      entries: [
        { type: 'payment', amount: '2500.00' },
        { type: 'invoice', amount: '12000.00', reference: 'ФХ-101' },
      ],
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
