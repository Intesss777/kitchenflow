import { describe, expect, test } from 'bun:test'

import {
  createInvoiceUploadRequestSchema,
  purchaseInvoiceListQuerySchema,
  updatePurchaseInvoiceRequestSchema,
} from './invoices'

describe('purchase invoice contracts', () => {
  test('accepts phone invoice photos within the storage limit', () => {
    expect(createInvoiceUploadRequestSchema.safeParse({
      contentType: 'image/heic',
      byteSize: 4_000_000,
    }).success).toBe(true)
    expect(createInvoiceUploadRequestSchema.safeParse({
      contentType: 'image/svg+xml',
      byteSize: 4_000_000,
    }).success).toBe(false)
  })

  test('requires complete review data before confirmation', () => {
    const base = {
      supplierId: '0199c000-0000-7000-8000-000000000010',
      invoiceNumber: 'МТ-1201',
      invoiceDate: '2026-10-11',
      dueAt: '2026-10-18',
      items: [{
        productId: '0199c000-0000-7000-8000-000000000030',
        detectedName: 'Лосось',
        unit: 'kilogram',
        quantity: '3.500',
        unitPrice: '1450.00',
      }],
    }
    expect(updatePurchaseInvoiceRequestSchema.safeParse(base).success).toBe(true)
    expect(updatePurchaseInvoiceRequestSchema.safeParse({ ...base, dueAt: '2026-10-10' }).success).toBe(false)
    expect(updatePurchaseInvoiceRequestSchema.safeParse({ ...base, items: [] }).success).toBe(false)
  })

  test('accepts invoice archive ranges and rejects incomplete ranges', () => {
    expect(purchaseInvoiceListQuerySchema.parse({
      from: '2026-01-01',
      to: '2026-12-31',
      page: '2',
    })).toMatchObject({ from: '2026-01-01', to: '2026-12-31', page: 2, pageSize: 200 })
    expect(purchaseInvoiceListQuerySchema.safeParse({ from: '2026-10-01' }).success).toBe(false)
    expect(purchaseInvoiceListQuerySchema.safeParse({
      from: '2026-10-31',
      to: '2026-10-01',
    }).success).toBe(false)
  })
})
