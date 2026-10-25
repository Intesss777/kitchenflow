import type { InventoryProduct } from '@kitchenflow/contracts'

export type InventoryFilter = 'all' | 'low' | 'healthy'

export function filterInventoryProducts(
  products: ReadonlyArray<InventoryProduct>,
  filter: InventoryFilter,
) {
  if (filter === 'all') return products
  return products.filter((product) =>
    filter === 'low' ? product.isLowStock : !product.isLowStock,
  )
}
