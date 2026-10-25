import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WorkspaceMembersQuery, WorkspaceRole } from '@kitchenflow/contracts'

import { useAuth } from '@/features/auth'
import type { AuthenticatedTransport } from '@/platform/api'
import {
  getAdminDashboard,
  getWorkspaceMembers,
  updateWorkspaceMemberBranchAccess,
  updateWorkspaceMemberRole,
} from './api'

const adminQueryKeys = {
  all: ['session', 'admin'] as const,
  dashboard: () => [...adminQueryKeys.all, 'dashboard'] as const,
  users: (query: WorkspaceMembersQuery) => [...adminQueryKeys.all, 'users', query] as const,
}

export function adminDashboardQueryOptions(transport: AuthenticatedTransport) {
  return queryOptions({
    queryKey: adminQueryKeys.dashboard(),
    queryFn: ({ signal }) => getAdminDashboard(transport, { signal }),
  })
}

export function workspaceMembersQueryOptions(
  transport: AuthenticatedTransport,
  query: WorkspaceMembersQuery,
) {
  return queryOptions({
    queryKey: adminQueryKeys.users(query),
    // Every page or search term is its own key. Forwarding the signal aborts the superseded page
    // when the key changes: the browser stops downloading a response nobody will render, and a
    // cancelled request is never retried after a token refresh. A request already dispatched
    // still counts against the backend's admin read rate limit, which increments on arrival.
    queryFn: ({ signal }) => getWorkspaceMembers(transport, query, { signal }),
  })
}

export function useAdminDashboardQuery() {
  const auth = useAuth()
  return useQuery(adminDashboardQueryOptions(auth.transport))
}

export function useWorkspaceMembersQuery(query: WorkspaceMembersQuery) {
  const auth = useAuth()
  return useQuery(workspaceMembersQueryOptions(auth.transport, query))
}

export function useUpdateWorkspaceMemberRoleMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: WorkspaceRole }) =>
      updateWorkspaceMemberRole(auth.transport, membershipId, { role }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: [...adminQueryKeys.all, 'users'] }),
      ])
    },
  })
}

export function useUpdateWorkspaceMemberBranchAccessMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      allBranches,
      branchIds,
      membershipId,
    }: {
      allBranches: boolean
      branchIds: string[]
      membershipId: string
    }) => updateWorkspaceMemberBranchAccess(auth.transport, membershipId, {
      allBranches,
      branchIds,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...adminQueryKeys.all, 'users'] })
    },
  })
}
