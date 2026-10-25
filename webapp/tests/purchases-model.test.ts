import { describe, expect, test } from 'bun:test'
import type { PurchaseDraftProduct } from '@kitchenflow/contracts'

import {
  adjustPurchaseQuantity,
  isPurchaseQuantityInput,
  normalizeManualPurchaseQuantity,
  normalizePurchaseQuantity,
  parsePurchaseQuantity,
  purchaseDraftInput,
  suggestedPurchaseQuantity,
  updatePurchaseItem,
} from '@/features/purchases'

const product = (overrides: Partial<PurchaseDraftProduct> = {}): PurchaseDraftProduct => ({
  id: '0199c000-0000-7000-8000-000000000030',
  name: 'Сыр сливочный',
  category: 'Молочные продукты',
  unit: 'kilogram',
  currentQuantity: '3.200',
  minimumQuantity: '5.000',
  unitCost: null,
  isLowStock: true,
  ...overrides,
})

describe('purchase draft model', () => {
  test('suggests the shortage and still adds one useful unit when stock is sufficient', () => {
    expect(suggestedPurchaseQuantity(product())).toBe('1.8')
    expect(suggestedPurchaseQuantity(product({ currentQuantity: '8.000' }))).toBe('1')
    expect(suggestedPurchaseQuantity(product({ unit: 'piece' }))).toBe('2')
  })

  test('external plus and minus use whole numbers for every unit', () => {
    expect(normalizePurchaseQuantity('2.001', 'kilogram')).toBe('2')
    expect(normalizePurchaseQuantity('3.003', 'piece')).toBe('3')
    expect(adjustPurchaseQuantity('1', 'kilogram', 1)).toBe('2')
    expect(adjustPurchaseQuantity('1.5', 'kilogram', 1)).toBe('2.5')
    expect(adjustPurchaseQuantity('1.5', 'kilogram', -1)).toBe('0.5')
    expect(adjustPurchaseQuantity('82', 'piece', 1)).toBe('83')
  })

  test('accepts a manual decimal quantity with a dot or comma', () => {
    expect(isPurchaseQuantityInput('')).toBe(true)
    expect(isPurchaseQuantityInput('1,')).toBe(true)
    expect(isPurchaseQuantityInput('1,5')).toBe(true)
    expect(isPurchaseQuantityInput('1.2345')).toBe(false)
    expect(isPurchaseQuantityInput('abc')).toBe(false)
    expect(parsePurchaseQuantity('1,5')).toBe(1.5)
    expect(normalizeManualPurchaseQuantity('1,500')).toBe('1.5')
    expect(normalizeManualPurchaseQuantity('')).toBeNull()
  })

  test('replaces one product without creating a duplicate and trims the note', () => {
    const secondProductId = '0199c000-0000-7000-8000-000000000031'
    const items = updatePurchaseItem(
      [
        { productId: product().id, requestedQuantity: '1' },
        { productId: secondProductId, requestedQuantity: '4' },
      ],
      product().id,
      '2.5',
    )
    expect(purchaseDraftInput('  до 10:00  ', items)).toEqual({
      note: 'до 10:00',
      items: [
        { productId: product().id, requestedQuantity: '2.500' },
        { productId: secondProductId, requestedQuantity: '4.000' },
      ],
    })
  })
})
