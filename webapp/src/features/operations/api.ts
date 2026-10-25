import {
  createSupplierLedgerEntryRequestSchema,
  createSupplierLedgerEntryResponseSchema,
  createSupplierRequestSchema,
  createSupplierResponseSchema,
  operationsDashboardQuerySchema,
  operationsDashboardResponseSchema,
  supplierDetailResponseSchema,
  updateSupplierRequestSchema,
  updateSupplierResponseSchema,
  type CreateSupplierLedgerEntryRequest,
  type CreateSupplierRequest,
  type OperationsDashboardQuery,
  type UpdateSupplierRequest,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function getOperationsDashboard(
  transport: AuthenticatedTransport,
  query: OperationsDashboardQuery = {},
  options: { signal?: AbortSignal } = {},
) {
  const range = operationsDashboardQuerySchema.parse(query)
  const search = range.from && range.to
    ? `?${new URLSearchParams({ from: range.from, to: range.to })}`
    : ''
  return transport.request(
    `/api/operations/dashboard${search}`,
    operationsDashboardResponseSchema,
    options,
  )
}

export function getSupplier(
  transport: AuthenticatedTransport,
  supplierId: string,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request(
    `/api/operations/suppliers/${encodeURIComponent(supplierId)}`,
    supplierDetailResponseSchema,
    options,
  )
}

export function createSupplier(
  transport: AuthenticatedTransport,
  input: CreateSupplierRequest,
) {
  return transport.request(
    '/api/operations/suppliers',
    createSupplierResponseSchema,
    { method: 'POST', body: createSupplierRequestSchema.parse(input) },
  )
}

export function updateSupplier(
  transport: AuthenticatedTransport,
  supplierId: string,
  input: UpdateSupplierRequest,
) {
  return transport.request(
    `/api/operations/suppliers/${encodeURIComponent(supplierId)}`,
    updateSupplierResponseSchema,
    { method: 'PATCH', body: updateSupplierRequestSchema.parse(input) },
  )
}

export function createSupplierLedgerEntry(
  transport: AuthenticatedTransport,
  supplierId: string,
  input: CreateSupplierLedgerEntryRequest,
) {
  return transport.request(
    `/api/operations/suppliers/${encodeURIComponent(supplierId)}/entries`,
    createSupplierLedgerEntryResponseSchema,
    { method: 'POST', body: createSupplierLedgerEntryRequestSchema.parse(input) },
  )
}
