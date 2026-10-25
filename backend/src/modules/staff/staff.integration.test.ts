import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { seedKitchenFlowFixtures } from '../../../scripts/kitchenflow-fixtures'
import { bootstrapDevelopmentData } from '../../../scripts/development-seed'
import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required; run bun run test:backend:integration')

describe('staff API integration', () => {
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

  test('lets the chef record manual lateness and fines for the owner monthly view', async () => {
    const chefToken = await login(accounts.user.email)
    const ownerToken = await login(accounts.admin.email)
    const employeeResponse = await request('/api/staff/employees', chefToken, 'POST', {
      name: 'Алексей Смирнов',
      position: 'Су-шеф',
    })
    expect(employeeResponse.status).toBe(201)
    const employee = (await employeeResponse.json()).employee

    for (const event of [
      {
        type: 'lateness',
        occurredOn: '2026-10-08',
        arrivalTime: '10:18',
        fineAmount: null,
        reason: 'Опоздал на утреннюю смену',
      },
      {
        type: 'fine',
        occurredOn: '2026-10-14',
        arrivalTime: null,
        fineAmount: '1500.00',
        reason: 'Не предупредил о замене смены',
      },
    ]) {
      const response = await request(`/api/staff/employees/${employee.id}/events`, chefToken, 'POST', event)
      expect(response.status).toBe(201)
    }

    const overview = await request('/api/staff?month=2026-10', ownerToken)
    expect(overview.status).toBe(200)
    const overviewBody = await overview.json()
    expect(overviewBody).toMatchObject({
      month: '2026-10',
      metrics: { activeEmployees: expect.any(Number) },
    })
    expect(overviewBody.events).toContainEqual(expect.objectContaining(
      { employeeId: employee.id, type: 'fine', occurredOn: '2026-10-14', fineAmount: '1500.00' },
    ))
    expect(overviewBody.events).toContainEqual(expect.objectContaining(
      { employeeId: employee.id, type: 'lateness', occurredOn: '2026-10-08', arrivalTime: '10:18' },
    ))
  })

  test('rejects an event for an employee outside the active workspace', async () => {
    const token = await login(accounts.user.email)
    const response = await request(
      '/api/staff/employees/0199c000-0000-7000-8000-000000000099/events',
      token,
      'POST',
      {
        type: 'fine',
        occurredOn: '2026-10-12',
        arrivalTime: null,
        fineAmount: '500.00',
        reason: 'Нарушение правила',
      },
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      error: { message: 'Сотрудник не найден' },
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
