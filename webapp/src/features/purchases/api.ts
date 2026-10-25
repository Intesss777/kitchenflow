import {
  preparePurchaseMessageRequestSchema,
  preparePurchaseMessageResponseSchema,
  purchaseDraftResponseSchema,
  savePurchaseDraftRequestSchema,
  type PreparePurchaseMessageRequest,
  type SavePurchaseDraftRequest,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function getPurchaseDraft(
  transport: AuthenticatedTransport,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request('/api/purchases/draft', purchaseDraftResponseSchema, options)
}

export function savePurchaseDraft(
  transport: AuthenticatedTransport,
  input: SavePurchaseDraftRequest,
) {
  return transport.request('/api/purchases/draft', purchaseDraftResponseSchema, {
    method: 'PUT',
    body: savePurchaseDraftRequestSchema.parse(input),
  })
}

export function preparePurchaseMessage(
  transport: AuthenticatedTransport,
  input: PreparePurchaseMessageRequest,
) {
  return transport.request('/api/purchases/draft/prepare', preparePurchaseMessageResponseSchema, {
    method: 'POST',
    body: preparePurchaseMessageRequestSchema.parse(input),
  })
}
