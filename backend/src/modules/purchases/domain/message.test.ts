import { describe, expect, test } from 'bun:test'
import type { PurchaseDraftResponse } from '@kitchenflow/contracts'

import { buildPurchaseMessage } from './message'

const draft: PurchaseDraftResponse = {
  workspace: {
    organizationName: 'KitchenFlow',
    branchName: 'Основной ресторан',
    role: 'owner',
  },
  note: null,
  items: [{
    productId: '0199c000-0000-7000-8000-000000000030',
    name: 'Сыр сливочный',
    unit: 'kilogram',
    requestedQuantity: '3.000',
    lineCost: '2280.00',
  }],
  products: [{
    id: '0199c000-0000-7000-8000-000000000030',
    name: 'Сыр сливочный',
    category: 'Молочные продукты',
    unit: 'kilogram',
    currentQuantity: '3.200',
    minimumQuantity: '5.000',
    unitCost: '760.00',
    isLowStock: true,
  }],
  metrics: {
    itemCount: 1,
    lowStockCount: 1,
    estimatedTotal: '2280.00',
  },
  updatedAt: null,
}

describe('purchase message', () => {
  test('contains quantities but no prices by default', () => {
    const message = buildPurchaseMessage(draft, false)
    expect(message).toContain('Сыр сливочный — 3 кг')
    expect(message).not.toContain('Поставщик')
    expect(message).not.toContain('760')
    expect(message).not.toContain('2280')
    expect(message).not.toContain('₽')
  })

  test('adds the last unit prices, line costs, and total only when requested', () => {
    const message = buildPurchaseMessage(draft, true)
    expect(message).toContain('760 ₽')
    expect(message).toContain('2 280 ₽')
    expect(message.match(/2 280 ₽/g)).toHaveLength(2)
  })
})
