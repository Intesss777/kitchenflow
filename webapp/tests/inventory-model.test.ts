import { describe, expect, test } from 'bun:test'
import type { InventoryProduct } from '@kitchenflow/contracts'

import { filterInventoryProducts } from '@/features/inventory'

const product = (name: string, isLowStock: boolean): InventoryProduct => ({
  id: isLowStock
    ? '0199c000-0000-7000-8000-000000000041'
    : '0199c000-0000-7000-8000-000000000042',
  name,
  category: 'Молочные продукты',
  unit: 'kilogram',
  quantity: isLowStock ? '1.000' : '8.000',
  minimumQuantity: '5.000',
  unitCost: null,
  isLowStock,
  updatedAt: '2026-10-13T12:00:00.000Z',
})

describe('inventory filters', () => {
  const products = [product('Сыр', true), product('Масло', false)]

  test('shows all, low-stock, and healthy products', () => {
    expect(filterInventoryProducts(products, 'all')).toEqual(products)
    expect(
      filterInventoryProducts(products, 'low').map((item) => item.name),
    ).toEqual(['Сыр'])
    expect(
      filterInventoryProducts(products, 'healthy').map((item) => item.name),
    ).toEqual(['Масло'])
  })
})
