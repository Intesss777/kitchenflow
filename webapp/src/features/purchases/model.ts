import type {
  InventoryUnit,
  PurchaseDraftProduct,
  PurchaseDraftResponse,
  SavePurchaseDraftRequest,
} from '@kitchenflow/contracts'

import { quantityInputStep } from '@/platform/intl/quantity'

export type EditablePurchaseItem = SavePurchaseDraftRequest['items'][number]

export function purchaseDraftInput(
  note: string,
  items: ReadonlyArray<EditablePurchaseItem>,
): SavePurchaseDraftRequest {
  return {
    note: note.trim() || null,
    items: items.map((item) => ({
      ...item,
      requestedQuantity: serializePurchaseQuantity(item.requestedQuantity),
    })),
  }
}

export function initialPurchaseItems(draft: PurchaseDraftResponse): EditablePurchaseItem[] {
  const productsById = new Map(draft.products.map((product) => [product.id, product]))
  return draft.items.map((item) => ({
    productId: item.productId,
    requestedQuantity: productsById.has(item.productId)
      ? normalizePurchaseQuantity(item.requestedQuantity, productsById.get(item.productId)!.unit)
      : item.requestedQuantity,
  }))
}

export function suggestedPurchaseQuantity(product: PurchaseDraftProduct) {
  const step = product.unit === 'piece' ? 1 : product.unit === 'gram' || product.unit === 'milliliter' ? 100 : 1
  const shortage = Number(product.minimumQuantity) - Number(product.currentQuantity)
  const suggested = Math.max(step, shortage)
  return formatEditableQuantity(product.unit === 'piece' ? Math.ceil(suggested) : suggested)
}

export function updatePurchaseItem(
  items: ReadonlyArray<EditablePurchaseItem>,
  productId: string,
  requestedQuantity: string,
) {
  const index = items.findIndex((item) => item.productId === productId)
  if (index === -1) return [...items, { productId, requestedQuantity }]
  return items.map((item, itemIndex) => (
    itemIndex === index ? { productId, requestedQuantity } : item
  ))
}

export function isPurchaseQuantityInput(value: string) {
  return /^\d*(?:[.,]\d{0,3})?$/.test(value)
}

export function parsePurchaseQuantity(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!/^(?:\d+|\d*\.\d+)$/.test(normalized)) return null
  const quantity = Number(normalized)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null
}

export function normalizeManualPurchaseQuantity(value: string) {
  const quantity = parsePurchaseQuantity(value)
  return quantity === null ? null : formatEditableQuantity(quantity)
}

export function adjustPurchaseQuantity(value: string, unit: InventoryUnit, delta: -1 | 1) {
  const current = parsePurchaseQuantity(value) ?? 0
  const minimum = Number(quantityInputStep(unit))
  return formatEditableQuantity(Math.max(minimum, current + delta))
}

export function normalizePurchaseQuantity(value: string, unit: InventoryUnit) {
  const current = parsePurchaseQuantity(value)
  const step = Number(quantityInputStep(unit))
  if (current === null) return value
  return formatEditableQuantity(Math.max(step, Math.round(current / step) * step))
}

function formatEditableQuantity(value: number) {
  return Math.max(0.001, value).toFixed(3).replace(/\.?0+$/, '')
}

function serializePurchaseQuantity(value: string) {
  const quantity = parsePurchaseQuantity(value)
  return quantity === null ? value : quantity.toFixed(3)
}
