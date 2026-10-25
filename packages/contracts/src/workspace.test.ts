import { describe, expect, test } from 'bun:test'
import type { ActiveWorkspace, WorkspaceMember } from './index'

import {
  activeWorkspaceSchema,
  createWorkspaceBranchRequestSchema,
  switchWorkspaceBranchRequestSchema,
  updateWorkspaceMemberBranchAccessRequestSchema,
  updateWorkspaceMemberRoleRequestSchema,
  workspaceMemberSchema,
  updateWorkspaceBranchStatusRequestSchema,
  workspaceRoleSchema,
} from './index'

describe('workspace access contracts', () => {
  test('defines product roles independently from the platform account role', () => {
    expect(workspaceRoleSchema.options).toEqual(['owner', 'chef', 'administrator'])
    expect(updateWorkspaceMemberRoleRequestSchema.parse({ role: 'administrator' })).toEqual({
      role: 'administrator',
    })
    expect(() => updateWorkspaceMemberRoleRequestSchema.parse({ role: 'admin' })).toThrow()
  })

  test('describes the active organization and branch carried by the session', () => {
    const workspace: ActiveWorkspace = {
      organizationId: '019c0000-0000-7000-8000-000000000001',
      organizationName: 'KitchenFlow',
      branchId: '019c0000-0000-7000-8000-000000000002',
      branchName: 'Основной',
      role: 'administrator',
      availableBranches: [
        { id: '019c0000-0000-7000-8000-000000000002', name: 'Основной' },
        { id: '019c0000-0000-7000-8000-000000000005', name: 'Веранда' },
      ],
    }

    expect(activeWorkspaceSchema.parse(workspace)).toEqual(workspace)
  })

  test('keeps access-directory rows scoped to membership data', () => {
    const member: WorkspaceMember = {
      id: '019c0000-0000-7000-8000-000000000003',
      userId: '019c0000-0000-7000-8000-000000000004',
      email: 'manager@example.com',
      displayName: 'Manager',
      role: 'administrator',
      branchAccess: {
        allBranches: false,
        branchIds: ['019c0000-0000-7000-8000-000000000002'],
      },
      createdAt: '2026-10-12T00:00:00.000Z',
    }

    expect(workspaceMemberSchema.parse(member)).toEqual(member)
    expect(() => workspaceMemberSchema.parse({ ...member, accountRole: 'admin' })).toThrow()
  })

  test('requires at least one branch when access is restricted', () => {
    const branchId = '019c0000-0000-7000-8000-000000000002'
    expect(updateWorkspaceMemberBranchAccessRequestSchema.parse({
      allBranches: false,
      branchIds: [branchId],
    })).toEqual({ allBranches: false, branchIds: [branchId] })
    expect(updateWorkspaceMemberBranchAccessRequestSchema.parse({
      allBranches: true,
      branchIds: [],
    })).toEqual({ allBranches: true, branchIds: [] })
    expect(() => updateWorkspaceMemberBranchAccessRequestSchema.parse({
      allBranches: false,
      branchIds: [],
    })).toThrow()
    expect(switchWorkspaceBranchRequestSchema.parse({ branchId })).toEqual({ branchId })
  })

  test('normalizes owner-managed branch details and status changes', () => {
    expect(createWorkspaceBranchRequestSchema.parse({
      name: '  Веранда  ',
      address: '  ул. Тверская, 12  ',
    })).toEqual({ name: 'Веранда', address: 'ул. Тверская, 12' })
    expect(createWorkspaceBranchRequestSchema.parse({
      name: 'Бар',
      address: '   ',
    })).toEqual({ name: 'Бар', address: null })
    expect(updateWorkspaceBranchStatusRequestSchema.parse({ isActive: false })).toEqual({
      isActive: false,
    })
    expect(() => createWorkspaceBranchRequestSchema.parse({ name: '', address: null })).toThrow()
  })
})
