import type {
  PurchaseDraftResponse,
  SavePurchaseDraftRequest,
} from '@kitchenflow/contracts'

export type PurchaseDraftRepository = {
  readDraft(userId: string): Promise<PurchaseDraftResponse>
  saveDraft(userId: string, input: SavePurchaseDraftRequest): Promise<void>
}
