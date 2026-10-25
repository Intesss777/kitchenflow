import {
  createSalesReceiptUploadRequestSchema,
  createSalesReceiptUploadResponseSchema,
  salesShiftResponseSchema,
  salesShiftsOverviewResponseSchema,
  updateSalesShiftRequestSchema,
  type CreateSalesReceiptUploadRequest,
  type UpdateSalesShiftRequest,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function getSalesShifts(
  transport: AuthenticatedTransport,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request('/api/shifts', salesShiftsOverviewResponseSchema, options)
}

export function getSalesShift(
  transport: AuthenticatedTransport,
  shiftId: string,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request(
    `/api/shifts/${encodeURIComponent(shiftId)}`,
    salesShiftResponseSchema,
    options,
  )
}

export function createSalesReceiptUpload(
  transport: AuthenticatedTransport,
  input: CreateSalesReceiptUploadRequest,
) {
  return transport.request('/api/shifts/uploads', createSalesReceiptUploadResponseSchema, {
    method: 'POST',
    body: createSalesReceiptUploadRequestSchema.parse(input),
  })
}

export function finalizeSalesReceiptUpload(
  transport: AuthenticatedTransport,
  receiptId: string,
) {
  return transport.request(
    `/api/shifts/receipts/${encodeURIComponent(receiptId)}/finalize`,
    salesShiftResponseSchema,
    { method: 'POST' },
  )
}

export function updateSalesShift(
  transport: AuthenticatedTransport,
  shiftId: string,
  input: UpdateSalesShiftRequest,
) {
  return transport.request(
    `/api/shifts/${encodeURIComponent(shiftId)}`,
    salesShiftResponseSchema,
    { method: 'PATCH', body: updateSalesShiftRequestSchema.parse(input) },
  )
}

export function confirmSalesShift(transport: AuthenticatedTransport, shiftId: string) {
  return transport.request(
    `/api/shifts/${encodeURIComponent(shiftId)}/confirm`,
    salesShiftResponseSchema,
    { method: 'POST' },
  )
}
