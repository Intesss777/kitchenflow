import {
  createWorkspaceBranchRequestSchema,
  switchWorkspaceBranchRequestSchema,
  switchWorkspaceBranchResponseSchema,
  updateWorkspaceBranchRequestSchema,
  updateWorkspaceBranchStatusRequestSchema,
  workspaceBranchResponseSchema,
  workspaceBranchesResponseSchema,
  type CreateWorkspaceBranchRequest,
  type SwitchWorkspaceBranchRequest,
  type UpdateWorkspaceBranchRequest,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function switchWorkspaceBranch(
  transport: AuthenticatedTransport,
  input: SwitchWorkspaceBranchRequest,
) {
  return transport.request('/api/workspace/branch', switchWorkspaceBranchResponseSchema, {
    method: 'PATCH',
    body: switchWorkspaceBranchRequestSchema.parse(input),
  })
}

export function getWorkspaceBranches(
  transport: AuthenticatedTransport,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request('/api/workspace/branches', workspaceBranchesResponseSchema, options)
}

export function createWorkspaceBranch(
  transport: AuthenticatedTransport,
  input: CreateWorkspaceBranchRequest,
) {
  return transport.request('/api/workspace/branches', workspaceBranchResponseSchema, {
    method: 'POST',
    body: createWorkspaceBranchRequestSchema.parse(input),
  })
}

export function updateWorkspaceBranch(
  transport: AuthenticatedTransport,
  branchId: string,
  input: UpdateWorkspaceBranchRequest,
) {
  return transport.request(
    `/api/workspace/branches/${encodeURIComponent(branchId)}`,
    workspaceBranchResponseSchema,
    { method: 'PATCH', body: updateWorkspaceBranchRequestSchema.parse(input) },
  )
}

export function updateWorkspaceBranchStatus(
  transport: AuthenticatedTransport,
  branchId: string,
  isActive: boolean,
) {
  return transport.request(
    `/api/workspace/branches/${encodeURIComponent(branchId)}/status`,
    workspaceBranchResponseSchema,
    {
      method: 'PATCH',
      body: updateWorkspaceBranchStatusRequestSchema.parse({ isActive }),
    },
  )
}
