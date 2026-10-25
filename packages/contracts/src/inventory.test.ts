import { describe, expect, test } from 'bun:test'

import {
  createInventoryMovementRequestSchema,
  createInventoryProductRequestSchema,
  archiveInventoryProductResponseSchema,
  inventoryOverviewResponseSchema,
  updateInventoryProductRequestSchema,
} from './inventory'

describe('inventory contracts', () => {
  test('accepts supported units and fixed precision quantities', () => {
    expect(createInventoryProductRequestSchema.safeParse({
      name: 'Лосось',
      category: 'Рыба',
      unit: 'kilogram',
      minimumQuantity: '4.500',
      unitCost: '1450.00',
    }).success).toBe(true)
    expect(createInventoryProductRequestSchema.safeParse({
      name: 'Лосось',
      category: null,
      unit: 'box',
      minimumQuantity: '4.5',
      unitCost: null,
    }).success).toBe(false)
  })

  test('requires positive movement input', () => {
    const base = {
      type: 'writeoff',
      occurredAt: new Date().toISOString(),
      unitCost: null,
      reference: null,
      note: null,
    }
    expect(createInventoryMovementRequestSchema.safeParse({ ...base, quantity: '1.250' }).success).toBe(true)
    expect(createInventoryMovementRequestSchema.safeParse({ ...base, quantity: '0.000' }).success).toBe(false)
    expect(createInventoryMovementRequestSchema.safeParse({ ...base, type: 'stocktake', quantity: '0.000' }).success).toBe(true)
  })

  test('allows redacted owner-only values', () => {
    const parsed = inventoryOverviewResponseSchema.safeParse({
      workspace: { organizationName: 'KitchenFlow', branchName: 'Центр', role: 'chef' },
      metrics: { activeProducts: 0, lowStockProducts: 0, receiptsToday: 0, stockValue: null },
      products: [],
    })
    expect(parsed.success).toBe(true)
  })

  test('updates editable product fields without changing its unit', () => {
    const input = {
      name: 'Лосось атлантический',
      category: 'Рыба',
      minimumQuantity: '5.000',
      unitCost: '1550.00',
    }
    expect(updateInventoryProductRequestSchema.parse(input)).toEqual(input)
    expect(updateInventoryProductRequestSchema.safeParse({
      ...input,
      unit: 'piece',
    }).success).toBe(false)
  })

  test('returns an explicit archive result', () => {
    expect(archiveInventoryProductResponseSchema.parse({ archived: true })).toEqual({
      archived: true,
    })
  })
})
