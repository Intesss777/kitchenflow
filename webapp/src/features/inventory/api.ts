import {
  archiveInventoryProductResponseSchema,
  createInventoryMovementRequestSchema,
  createInventoryMovementResponseSchema,
  createInventoryProductRequestSchema,
  createInventoryProductResponseSchema,
  inventoryOverviewResponseSchema,
  inventoryProductDetailResponseSchema,
  updateInventoryProductRequestSchema,
  updateInventoryProductResponseSchema,
  type CreateInventoryMovementRequest,
  type CreateInventoryProductRequest,
  type UpdateInventoryProductRequest,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function getInventoryOverview(
  transport: AuthenticatedTransport,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request('/api/inventory', inventoryOverviewResponseSchema, options)
}

export function updateInventoryProduct(
  transport: AuthenticatedTransport,
  productId: string,
  input: UpdateInventoryProductRequest,
) {
  return transport.request(
    `/api/inventory/products/${encodeURIComponent(productId)}`,
    updateInventoryProductResponseSchema,
    { method: 'PATCH', body: updateInventoryProductRequestSchema.parse(input) },
  )
}

export function archiveInventoryProduct(
  transport: AuthenticatedTransport,
  productId: string,
) {
  return transport.request(
    `/api/inventory/products/${encodeURIComponent(productId)}`,
    archiveInventoryProductResponseSchema,
    { method: 'DELETE' },
  )
}

export function getInventoryProduct(
  transport: AuthenticatedTransport,
  productId: string,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request(
    `/api/inventory/products/${encodeURIComponent(productId)}`,
    inventoryProductDetailResponseSchema,
    options,
  )
}

export function createInventoryProduct(
  transport: AuthenticatedTransport,
  input: CreateInventoryProductRequest,
) {
  return transport.request('/api/inventory/products', createInventoryProductResponseSchema, {
    method: 'POST',
    body: createInventoryProductRequestSchema.parse(input),
  })
}

export function createInventoryMovement(
  transport: AuthenticatedTransport,
  productId: string,
  input: CreateInventoryMovementRequest,
) {
  return transport.request(
    `/api/inventory/products/${encodeURIComponent(productId)}/movements`,
    createInventoryMovementResponseSchema,
    { method: 'POST', body: createInventoryMovementRequestSchema.parse(input) },
  )
}
