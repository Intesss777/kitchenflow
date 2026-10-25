import type { PurchaseDraftResponse } from '@kitchenflow/contracts'

const unitLabels: Record<PurchaseDraftResponse['products'][number]['unit'], string> = {
  kilogram: 'кг',
  gram: 'г',
  liter: 'л',
  milliliter: 'мл',
  piece: 'шт.',
}

export function buildPurchaseMessage(
  draft: PurchaseDraftResponse,
  includePrices = false,
) {
  const productsById = new Map(draft.products.map((product) => [product.id, product]))
  const lines = draft.items.map((item, index) => {
    const quantity = `${formatQuantity(item.requestedQuantity)} ${unitLabels[item.unit]}`
    const base = `${index + 1}. ${item.name} — ${quantity}`
    const product = productsById.get(item.productId)
    return includePrices && product?.unitCost && item.lineCost
      ? `${base} × ${formatMoney(product.unitCost)} = ${formatMoney(item.lineCost)}`
      : base
  })
  return [
    `Закупка — ${draft.workspace.branchName}`,
    '',
    ...lines,
    ...(includePrices && draft.metrics.estimatedTotal
      ? ['', `Итого по прошлым ценам: ${formatMoney(draft.metrics.estimatedTotal)}`]
      : []),
    ...(draft.note ? ['', `Комментарий: ${draft.note}`] : []),
  ].join('\n')
}

function formatQuantity(value: string) {
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 })
}

function formatMoney(value: string) {
  return `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
}
