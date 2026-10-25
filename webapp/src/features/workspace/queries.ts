import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateWorkspaceBranchRequest,
  MeResponse,
  UpdateWorkspaceBranchRequest,
} from '@kitchenflow/contracts'

import { authQueryKeys, sessionQueryKeys, useAuth } from '@/features/auth'
import {
  createWorkspaceBranch,
  getWorkspaceBranches,
  switchWorkspaceBranch,
  updateWorkspaceBranch,
  updateWorkspaceBranchStatus,
} from './api'

const workspaceQueryKeys = {
  all: [...sessionQueryKeys.all, 'workspace'] as const,
  branches: () => [...workspaceQueryKeys.all, 'branches'] as const,
}

export function useSwitchWorkspaceBranchMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (branchId: string) => switchWorkspaceBranch(auth.transport, { branchId }),
    onSuccess: async ({ workspace }) => {
      await queryClient.cancelQueries({ queryKey: sessionQueryKeys.all })
      const currentSession = queryClient.getQueryData<MeResponse>(authQueryKeys.me())
      if (currentSession) {
        queryClient.setQueryData(authQueryKeys.me(), {
          user: { ...currentSession.user, workspace },
        } satisfies MeResponse)
      }
      await queryClient.invalidateQueries({ queryKey: sessionQueryKeys.all })
    },
  })
}

export function useWorkspaceBranchesQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: workspaceQueryKeys.branches(),
    queryFn: ({ signal }) => getWorkspaceBranches(auth.transport, { signal }),
  })
}

export function useCreateWorkspaceBranchMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateWorkspaceBranchRequest) =>
      createWorkspaceBranch(auth.transport, input),
    onSuccess: () => refreshWorkspaceQueries(queryClient),
  })
}

export function useUpdateWorkspaceBranchMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ branchId, input }: {
      branchId: string
      input: UpdateWorkspaceBranchRequest
    }) => updateWorkspaceBranch(auth.transport, branchId, input),
    onSuccess: () => refreshWorkspaceQueries(queryClient),
  })
}

export function useUpdateWorkspaceBranchStatusMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ branchId, isActive }: { branchId: string; isActive: boolean }) =>
      updateWorkspaceBranchStatus(auth.transport, branchId, isActive),
    onSuccess: () => refreshWorkspaceQueries(queryClient),
  })
}

async function refreshWorkspaceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: sessionQueryKeys.all })
}
