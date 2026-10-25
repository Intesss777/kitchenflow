import { describe, expect, test } from 'bun:test'

import { createStaffEventRequestSchema, staffOverviewQuerySchema } from './staff'

describe('staff contracts', () => {
  test('keeps lateness and fines as explicit manual events', () => {
    expect(createStaffEventRequestSchema.parse({
      type: 'lateness',
      occurredOn: '2026-10-12',
      arrivalTime: '10:20',
      fineAmount: null,
      reason: 'Опоздал на смену',
    }).arrivalTime).toBe('10:20')
    expect(createStaffEventRequestSchema.parse({
      type: 'fine',
      occurredOn: '2026-10-12',
      arrivalTime: null,
      fineAmount: '1500.00',
      reason: 'Нарушение внутреннего правила',
    }).fineAmount).toBe('1500.00')
  })

  test('rejects incomplete events and invalid months', () => {
    expect(() => createStaffEventRequestSchema.parse({
      type: 'lateness', occurredOn: '2026-10-12', arrivalTime: null, fineAmount: null, reason: 'Опоздание',
    })).toThrow()
    expect(() => staffOverviewQuerySchema.parse({ month: '2026-13' })).toThrow()
  })
})
