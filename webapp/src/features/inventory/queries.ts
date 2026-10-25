import type {
  CreateInventoryMovementRequest,
  CreateInventoryProductRequest,
  UpdateInventoryProductRequest,
} from '@kitchenflow/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth'
import {
  archiveInventoryProduct,
  createInventoryMovement,
  createInventoryProduct,
  getInventoryOverview,
  getInventoryProduct,
  updateInventoryProduct,
} from './api'

export const inventoryQueryKeys = {
  all: ['session', 'inventory'] as const,
  overview: () => [...inventoryQueryKeys.all, 'overview'] as const,
  product: (productId: string) => [...inventoryQueryKeys.all, 'product', productId] as const,
}

export function useUpdateInventoryProductMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      input,
      productId,
    }: {
      input: UpdateInventoryProductRequest
      productId: string
    }) => updateInventoryProduct(auth.transport, productId, input),
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.overview() }),
        queryClient.invalidateQueries({
          queryKey: inventoryQueryKeys.product(variables.productId),
        }),
        queryClient.invalidateQueries({ queryKey: ['session', 'purchases'] }),
      ])
    },
  })
}

export function useArchiveInventoryProductMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productId: string) => archiveInventoryProduct(auth.transport, productId),
    onSuccess: async (_response, productId) => {
      queryClient.removeQueries({ queryKey: inventoryQueryKeys.product(productId) })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: ['session', 'purchases'] }),
      ])
    },
  })
}

export function useInventoryOverviewQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: inventoryQueryKeys.overview(),
    queryFn: ({ signal }) => getInventoryOverview(auth.transport, { signal }),
  })
}

export function useInventoryProductQuery(productId: string | null) {
  const auth = useAuth()
  return useQuery({
    queryKey: inventoryQueryKeys.product(productId ?? 'none'),
    queryFn: ({ signal }) => getInventoryProduct(auth.transport, productId!, { signal }),
    enabled: productId !== null,
  })
}

export function useCreateInventoryProductMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInventoryProductRequest) =>
      createInventoryProduct(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.overview() })
    },
  })
}

export function useCreateInventoryMovementMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      input,
      productId,
    }: {
      input: CreateInventoryMovementRequest
      productId: string
    }) => createInventoryMovement(auth.transport, productId, input),
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.overview() }),
        queryClient.invalidateQueries({
          queryKey: inventoryQueryKeys.product(variables.productId),
        }),
      ])
    },
  })
}
