export type PurchasesFailureKind = 'conflict' | 'not_found'

export class PurchasesFailure extends Error {
  constructor(
    readonly kind: PurchasesFailureKind,
    message: string,
  ) {
    super(message)
    this.name = 'PurchasesFailure'
  }
}
