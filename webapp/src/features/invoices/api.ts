import {
  createInvoiceUploadRequestSchema,
  createInvoiceUploadResponseSchema,
  purchaseInvoiceListResponseSchema,
  purchaseInvoiceListQuerySchema,
  purchaseInvoiceResponseSchema,
  updatePurchaseInvoiceRequestSchema,
  type CreateInvoiceUploadRequest,
  type PurchaseInvoiceListQuery,
  type UpdatePurchaseInvoiceRequest,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function getPurchaseInvoices(
  transport: AuthenticatedTransport,
  query: PurchaseInvoiceListQuery,
  options: { signal?: AbortSignal } = {},
) {
  const parsed = purchaseInvoiceListQuerySchema.parse(query)
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  return transport.request(`/api/invoices?${search}`, purchaseInvoiceListResponseSchema, options)
}

export function getPurchaseInvoice(
  transport: AuthenticatedTransport,
  invoiceId: string,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request(
    `/api/invoices/${encodeURIComponent(invoiceId)}`,
    purchaseInvoiceResponseSchema,
    options,
  )
}

export function createInvoiceUpload(
  transport: AuthenticatedTransport,
  input: CreateInvoiceUploadRequest,
) {
  return transport.request('/api/invoices/uploads', createInvoiceUploadResponseSchema, {
    method: 'POST',
    body: createInvoiceUploadRequestSchema.parse(input),
  })
}

export function finalizeInvoiceUpload(
  transport: AuthenticatedTransport,
  invoiceId: string,
) {
  return transport.request(
    `/api/invoices/${encodeURIComponent(invoiceId)}/finalize`,
    purchaseInvoiceResponseSchema,
    { method: 'POST' },
  )
}

export function updatePurchaseInvoice(
  transport: AuthenticatedTransport,
  invoiceId: string,
  input: UpdatePurchaseInvoiceRequest,
) {
  return transport.request(
    `/api/invoices/${encodeURIComponent(invoiceId)}`,
    purchaseInvoiceResponseSchema,
    { method: 'PATCH', body: updatePurchaseInvoiceRequestSchema.parse(input) },
  )
}

export function confirmPurchaseInvoice(
  transport: AuthenticatedTransport,
  invoiceId: string,
) {
  return transport.request(
    `/api/invoices/${encodeURIComponent(invoiceId)}/confirm`,
    purchaseInvoiceResponseSchema,
    { method: 'POST' },
  )
}
