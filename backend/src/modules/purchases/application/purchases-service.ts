import type {
  PreparePurchaseMessageRequest,
  SavePurchaseDraftRequest,
} from '@kitchenflow/contracts'

import { PurchasesFailure } from '../domain/errors'
import { buildPurchaseMessage } from '../domain/message'
import type { PurchaseDraftRepository } from './ports'

export class PurchasesService {
  constructor(private readonly repository: PurchaseDraftRepository) {}

  draft(userId: string) {
    return this.repository.readDraft(userId)
  }

  async saveDraft(userId: string, input: SavePurchaseDraftRequest) {
    await this.repository.saveDraft(userId, input)
    return this.repository.readDraft(userId)
  }

  async prepareMessage(userId: string, input: PreparePurchaseMessageRequest) {
    if (input.items.length === 0) {
      throw new PurchasesFailure('conflict', 'Добавьте хотя бы один товар в список закупки')
    }
    const { includePrices, ...draftInput } = input
    await this.repository.saveDraft(userId, draftInput)
    const draft = await this.repository.readDraft(userId)
    const message = buildPurchaseMessage(draft, includePrices)
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    return { message, whatsappUrl }
  }
}
