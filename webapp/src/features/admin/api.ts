import {
  adminDashboardResponseSchema,
  updateWorkspaceMemberBranchAccessRequestSchema,
  updateWorkspaceMemberBranchAccessResponseSchema,
  updateWorkspaceMemberRoleRequestSchema,
  updateWorkspaceMemberRoleResponseSchema,
  workspaceMembersQuerySchema,
  workspaceMembersResponseSchema,
  type UpdateWorkspaceMemberRoleRequest,
  type UpdateWorkspaceMemberBranchAccessRequest,
  type WorkspaceMembersQuery,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function getAdminDashboard(
  transport: AuthenticatedTransport,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request('/api/admin/dashboard', adminDashboardResponseSchema, options)
}

export function updateWorkspaceMemberBranchAccess(
  transport: AuthenticatedTransport,
  membershipId: string,
  input: UpdateWorkspaceMemberBranchAccessRequest,
) {
  return transport.request(
    `/api/access/members/${encodeURIComponent(membershipId)}/branches`,
    updateWorkspaceMemberBranchAccessResponseSchema,
    {
      method: 'PATCH',
      body: updateWorkspaceMemberBranchAccessRequestSchema.parse(input),
    },
  )
}

export function getWorkspaceMembers(
  transport: AuthenticatedTransport,
  input: WorkspaceMembersQuery,
  options: { signal?: AbortSignal } = {},
) {
  const query = workspaceMembersQuerySchema.parse(input)
  const search = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  if (query.q) search.set('q', query.q)
  return transport.request(`/api/access/members?${search}`, workspaceMembersResponseSchema, options)
}

export function updateWorkspaceMemberRole(
  transport: AuthenticatedTransport,
  membershipId: string,
  input: UpdateWorkspaceMemberRoleRequest,
) {
  return transport.request(
    `/api/access/members/${encodeURIComponent(membershipId)}/role`,
    updateWorkspaceMemberRoleResponseSchema,
    {
      method: 'PATCH',
      body: updateWorkspaceMemberRoleRequestSchema.parse(input),
    },
  )
}
