import { queryOptions, useQuery } from '@tanstack/react-query'

import { useAuth } from '@/features/auth'
import type { AuthenticatedTransport } from '@/platform/api'
import type {
  CreateSupplierLedgerEntryRequest,
  CreateSupplierRequest,
  OperationsDashboardQuery,
  UpdateSupplierRequest,
} from '@kitchenflow/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  createSupplier,
  createSupplierLedgerEntry,
  getOperationsDashboard,
  getSupplier,
  updateSupplier,
} from './api'

export const operationsQueryKeys = {
  all: ['session', 'operations'] as const,
  dashboards: () => [...operationsQueryKeys.all, 'dashboard'] as const,
  dashboard: (query: OperationsDashboardQuery = {}) =>
    [...operationsQueryKeys.dashboards(), query] as const,
  supplier: (supplierId: string) => [...operationsQueryKeys.all, 'supplier', supplierId] as const,
}

export function useSupplierQuery(supplierId: string | null) {
  const auth = useAuth()
  return useQuery({
    queryKey: operationsQueryKeys.supplier(supplierId ?? 'none'),
    queryFn: ({ signal }) => getSupplier(auth.transport, supplierId!, { signal }),
    enabled: supplierId !== null,
  })
}

export function useCreateSupplierMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSupplierRequest) => createSupplier(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: operationsQueryKeys.dashboards() })
    },
  })
}

export function useUpdateSupplierMutation(supplierId: string) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSupplierRequest) => updateSupplier(auth.transport, supplierId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: operationsQueryKeys.dashboards() }),
        queryClient.invalidateQueries({ queryKey: operationsQueryKeys.supplier(supplierId) }),
      ])
    },
  })
}

export function useCreateLedgerEntryMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      input,
      supplierId,
    }: {
      input: CreateSupplierLedgerEntryRequest
      supplierId: string
    }) => createSupplierLedgerEntry(auth.transport, supplierId, input),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: operationsQueryKeys.dashboards() }),
        queryClient.invalidateQueries({ queryKey: operationsQueryKeys.supplier(variables.supplierId) }),
      ])
    },
  })
}

export function operationsDashboardQueryOptions(
  transport: AuthenticatedTransport,
  query: OperationsDashboardQuery = {},
) {
  return queryOptions({
    queryKey: operationsQueryKeys.dashboard(query),
    queryFn: ({ signal }) => getOperationsDashboard(transport, query, { signal }),
    placeholderData: (previousData) => previousData,
  })
}

export function useOperationsDashboardQuery(query: OperationsDashboardQuery = {}) {
  const auth = useAuth()
  return useQuery(operationsDashboardQueryOptions(auth.transport, query))
}
