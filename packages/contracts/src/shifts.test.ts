import { describe, expect, test } from 'bun:test'

import {
  createSalesReceiptUploadRequestSchema,
  updateSalesShiftRequestSchema,
} from './shifts'

describe('sales shift contracts', () => {
  test('accepts a dated receipt photo and bounded reviewed dish quantities', () => {
    expect(createSalesReceiptUploadRequestSchema.parse({
      shiftDate: '2026-10-11',
      contentType: 'image/jpeg',
      byteSize: 2048,
    })).toEqual({ shiftDate: '2026-10-11', contentType: 'image/jpeg', byteSize: 2048 })
    expect(updateSalesShiftRequestSchema.parse({
      lines: [{ dishId: '0199c000-0000-7000-8000-000000000060', quantity: 12 }],
    }).lines[0]?.quantity).toBe(12)
  })

  test('rejects duplicate dishes, fractional counts, and invalid dates', () => {
    const dishId = '0199c000-0000-7000-8000-000000000060'
    expect(updateSalesShiftRequestSchema.safeParse({
      lines: [{ dishId, quantity: 1 }, { dishId, quantity: 2 }],
    }).success).toBe(false)
    expect(updateSalesShiftRequestSchema.safeParse({
      lines: [{ dishId, quantity: 1.5 }],
    }).success).toBe(false)
    expect(createSalesReceiptUploadRequestSchema.safeParse({
      shiftDate: '11.10.2026',
      contentType: 'image/jpeg',
      byteSize: 2048,
    }).success).toBe(false)
  })
})

