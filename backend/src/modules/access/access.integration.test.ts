import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required; run bun run test:backend:integration')

describe('workspace role permissions', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: 'http://localhost:5173',
  })
  const prisma = createPrisma(databaseUrl)
  const app = createApp({ env, prisma })
  const password = 'password123'

  beforeEach(async () => {
    await prisma.organization.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('projects the active membership into the authenticated session', async () => {
    const sessions = await createWorkspaceUsers()

    expect(sessions.owner.user).toMatchObject({
      role: 'admin',
      workspace: { role: 'owner', organizationName: 'Role Test', branchName: 'Основной' },
    })
    expect(sessions.chef.user).toMatchObject({ role: 'user', workspace: { role: 'chef' } })
    expect(sessions.administrator.user).toMatchObject({
      role: 'user',
      workspace: { role: 'administrator' },
    })
  })

  test('enforces the product module matrix on the server', async () => {
    const sessions = await createWorkspaceUsers()
    const get = (path: string, accessToken: string) => app.request(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    expect((await get('/api/operations/dashboard', sessions.owner.accessToken)).status).toBe(200)
    expect((await get('/api/admin/users', sessions.owner.accessToken)).status).toBe(200)

    expect((await get('/api/inventory', sessions.chef.accessToken)).status).toBe(200)
    expect((await get('/api/purchases/draft', sessions.chef.accessToken)).status).toBe(200)
    expect((await get('/api/dishes', sessions.chef.accessToken)).status).toBe(200)
    expect((await get('/api/shifts', sessions.chef.accessToken)).status).toBe(200)
    expect((await get('/api/staff?month=2026-10', sessions.chef.accessToken)).status).toBe(200)
    expect((await get('/api/invoices', sessions.chef.accessToken)).status).toBe(403)
    expect((await get('/api/admin/users', sessions.chef.accessToken)).status).toBe(403)

    expect((await get('/api/inventory', sessions.administrator.accessToken)).status).toBe(200)
    expect((await get('/api/invoices', sessions.administrator.accessToken)).status).toBe(200)
    const createSupplier = await app.request('/api/operations/suppliers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessions.administrator.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Поставщик администратора',
        contactName: null,
        phone: null,
        whatsappPhone: null,
        paymentTermsDays: 7,
      }),
    })
    expect(createSupplier.status).toBe(201)
    expect((await get('/api/operations/dashboard', sessions.administrator.accessToken)).status).toBe(403)
    expect((await get('/api/dishes', sessions.administrator.accessToken)).status).toBe(403)
    expect((await get('/api/shifts', sessions.administrator.accessToken)).status).toBe(403)
    expect((await get('/api/staff?month=2026-10', sessions.administrator.accessToken)).status).toBe(403)
    expect((await get('/api/admin/users', sessions.administrator.accessToken)).status).toBe(403)

    const chefSupplier = await app.request('/api/operations/suppliers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessions.chef.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Поставщик шефа',
        contactName: null,
        phone: null,
        whatsappPhone: null,
        paymentTermsDays: 7,
      }),
    })
    expect(chefSupplier.status).toBe(403)
  })

  test('lets only the owner change a membership role and revokes the changed account sessions', async () => {
    const sessions = await createWorkspaceUsers()
    const list = await app.request('/api/access/members', {
      headers: { Authorization: `Bearer ${sessions.owner.accessToken}` },
    })
    expect(list.status).toBe(200)
    expect((await list.json()).items.map((item: { role: string }) => item.role).sort()).toEqual([
      'administrator',
      'chef',
      'owner',
    ])

    const selfDemotion = await app.request(
      `/api/access/members/${sessions.owner.membershipId}/role`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessions.owner.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'chef' }),
      },
    )
    expect(selfDemotion.status).toBe(409)

    const changed = await app.request(`/api/access/members/${sessions.chef.membershipId}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${sessions.owner.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'administrator' }),
    })
    expect(changed.status).toBe(200)
    expect((await changed.json()).member.role).toBe('administrator')
    expect((await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${sessions.chef.accessToken}` },
    })).status).toBe(401)

    const forbidden = await app.request(`/api/access/members/${sessions.owner.membershipId}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${sessions.administrator.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'administrator' }),
    })
    expect(forbidden.status).toBe(403)
  })

  test('switches the active branch and enforces member branch restrictions', async () => {
    const sessions = await createWorkspaceUsers()
    const secondBranch = await prisma.branch.create({
      data: { organizationId: sessions.organizationId, name: 'Веранда' },
    })

    const ownerMe = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${sessions.owner.accessToken}` },
    })
    expect(ownerMe.status).toBe(200)
    expect((await ownerMe.json()).user.workspace.availableBranches).toHaveLength(2)

    const ownerSwitch = await app.request('/api/workspace/branch', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${sessions.owner.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ branchId: secondBranch.id }),
    })
    expect(ownerSwitch.status).toBe(200)
    expect((await ownerSwitch.json()).workspace.branchName).toBe('Веранда')

    const restrictChef = await app.request(
      `/api/access/members/${sessions.chef.membershipId}/branches`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessions.owner.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ allBranches: false, branchIds: [sessions.branchId] }),
      },
    )
    expect(restrictChef.status).toBe(200)
    expect((await restrictChef.json()).member.branchAccess).toEqual({
      allBranches: false,
      branchIds: [sessions.branchId],
    })

    const deniedSwitch = await app.request('/api/workspace/branch', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${sessions.chef.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ branchId: secondBranch.id }),
    })
    expect(deniedSwitch.status).toBe(403)

    const chefMe = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${sessions.chef.accessToken}` },
    })
    expect((await chefMe.json()).user.workspace.availableBranches).toEqual([
      { id: sessions.branchId, name: 'Основной' },
    ])
  })

  test('lets the owner manage branch lifecycle without stranding a restricted member', async () => {
    const sessions = await createWorkspaceUsers()
    const ownerHeaders = {
      Authorization: `Bearer ${sessions.owner.accessToken}`,
      'Content-Type': 'application/json',
    }

    const created = await app.request('/api/workspace/branches', {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ name: 'Веранда', address: 'Летний двор' }),
    })
    expect(created.status).toBe(201)
    const secondBranch = (await created.json()).branch
    expect(secondBranch).toMatchObject({
      name: 'Веранда',
      address: 'Летний двор',
      isActive: true,
    })

    const forbiddenCreate = await app.request('/api/workspace/branches', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessions.chef.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Чужой филиал', address: null }),
    })
    expect(forbiddenCreate.status).toBe(403)

    const renamed = await app.request(`/api/workspace/branches/${secondBranch.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ name: 'Веранда у сада', address: null }),
    })
    expect(renamed.status).toBe(200)
    expect((await renamed.json()).branch).toMatchObject({
      name: 'Веранда у сада',
      address: null,
    })

    const restrictChef = await app.request(
      `/api/access/members/${sessions.chef.membershipId}/branches`,
      {
        method: 'PATCH',
        headers: ownerHeaders,
        body: JSON.stringify({ allBranches: false, branchIds: [secondBranch.id] }),
      },
    )
    expect(restrictChef.status).toBe(200)

    const blockedArchive = await app.request(
      `/api/workspace/branches/${secondBranch.id}/status`,
      {
        method: 'PATCH',
        headers: ownerHeaders,
        body: JSON.stringify({ isActive: false }),
      },
    )
    expect(blockedArchive.status).toBe(409)

    await app.request(`/api/access/members/${sessions.chef.membershipId}/branches`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ allBranches: false, branchIds: [sessions.branchId] }),
    })
    await app.request('/api/workspace/branch', {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ branchId: secondBranch.id }),
    })

    const archived = await app.request(`/api/workspace/branches/${secondBranch.id}/status`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ isActive: false }),
    })
    expect(archived.status).toBe(200)
    expect((await archived.json()).branch.isActive).toBe(false)

    const ownerMe = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${sessions.owner.accessToken}` },
    })
    expect((await ownerMe.json()).user.workspace).toMatchObject({
      branchId: sessions.branchId,
      availableBranches: [{ id: sessions.branchId, name: 'Основной' }],
    })

    const lastBranchArchive = await app.request(
      `/api/workspace/branches/${sessions.branchId}/status`,
      {
        method: 'PATCH',
        headers: ownerHeaders,
        body: JSON.stringify({ isActive: false }),
      },
    )
    expect(lastBranchArchive.status).toBe(409)

    const restored = await app.request(`/api/workspace/branches/${secondBranch.id}/status`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ isActive: true }),
    })
    expect(restored.status).toBe(200)
    expect((await restored.json()).branch.isActive).toBe(true)

    const listed = await app.request('/api/workspace/branches', {
      headers: { Authorization: `Bearer ${sessions.owner.accessToken}` },
    })
    expect(listed.status).toBe(200)
    expect((await listed.json()).items).toHaveLength(2)
  })

  async function createWorkspaceUsers() {
    const owner = await register('role-owner@example.com')
    const chef = await register('role-chef@example.com')
    const administrator = await register('role-administrator@example.com')
    await prisma.user.update({ where: { id: owner.user.id }, data: { role: 'admin' } })
    const [ownerMembership, chefMembership, administratorMembership] = await Promise.all([
      prisma.organizationMembership.findFirstOrThrow({
        where: { userId: owner.user.id },
        include: { organization: { include: { branches: true } } },
      }),
      prisma.organizationMembership.findFirstOrThrow({ where: { userId: chef.user.id } }),
      prisma.organizationMembership.findFirstOrThrow({ where: { userId: administrator.user.id } }),
    ])
    const organization = await prisma.organization.update({
      where: { id: ownerMembership.organizationId },
      data: { name: 'Role Test' },
    })
    const branch = await prisma.branch.update({
      where: { id: ownerMembership.organization.branches[0]!.id },
      data: { name: 'Основной' },
    })
    await prisma.organization.deleteMany({
      where: {
        id: { in: [chefMembership.organizationId, administratorMembership.organizationId] },
      },
    })
    const invitedMemberships = await Promise.all([
      prisma.organizationMembership.create({
        data: { organizationId: organization.id, userId: chef.user.id, role: 'chef' },
      }),
      prisma.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: administrator.user.id,
          role: 'administrator',
        },
      }),
    ])

    const [ownerLogin, chefLogin, administratorLogin] = await Promise.all([
      login('role-owner@example.com'),
      login('role-chef@example.com'),
      login('role-administrator@example.com'),
    ])
    return {
      organizationId: organization.id,
      branchId: branch.id,
      owner: { ...ownerLogin, membershipId: ownerMembership.id },
      chef: { ...chefLogin, membershipId: invitedMemberships[0]!.id },
      administrator: { ...administratorLogin, membershipId: invitedMemberships[1]!.id },
    }
  }

  async function register(email: string) {
    const response = await app.request('/api/auth/token/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    expect(response.status).toBe(201)
    return response.json() as Promise<{ user: { id: string } }>
  }

  async function login(email: string) {
    const response = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    expect(response.status).toBe(200)
    return response.json() as Promise<{
      accessToken: string
      user: { id: string; role: string; workspace: { role: string } | null }
    }>
  }
})
