export type InventoryFailureKind = 'conflict' | 'forbidden' | 'not_found'

export class InventoryFailure extends Error {
  constructor(
    readonly kind: InventoryFailureKind,
    message: string,
  ) {
    super(message)
    this.name = 'InventoryFailure'
  }
}
