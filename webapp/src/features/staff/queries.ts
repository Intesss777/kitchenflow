import type { CreateStaffEmployeeRequest, CreateStaffEventRequest } from '@kitchenflow/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth'
import { createStaffEmployee, createStaffEvent, getStaffOverview } from './api'

export const staffQueryKeys = {
  all: ['session', 'staff'] as const,
  overview: (month: string) => [...staffQueryKeys.all, 'overview', month] as const,
}

export function useStaffOverviewQuery(month: string) {
  const auth = useAuth()
  return useQuery({
    queryKey: staffQueryKeys.overview(month),
    queryFn: ({ signal }) => getStaffOverview(auth.transport, month, { signal }),
  })
}

export function useCreateStaffEmployeeMutation(month: string) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStaffEmployeeRequest) => createStaffEmployee(auth.transport, input),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: staffQueryKeys.overview(month) }),
  })
}

export function useCreateStaffEventMutation(month: string) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, input }: { employeeId: string; input: CreateStaffEventRequest }) =>
      createStaffEvent(auth.transport, employeeId, input),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: staffQueryKeys.overview(month) }),
  })
}
