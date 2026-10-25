import type { InventoryUnit } from '@kitchenflow/contracts'

export function quantityInputStep(unit: InventoryUnit) {
  return unit === 'kilogram' || unit === 'liter' ? '0.1' : '1'
}

export function moneyInputStep() {
  return '1'
}
