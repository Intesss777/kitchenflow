export type DishesFailureKind =
  | 'conflict'
  | 'expired'
  | 'not_found'
  | 'rejected'
  | 'upload_incomplete'

export class DishesFailure extends Error {
  constructor(readonly kind: DishesFailureKind, message: string) {
    super(message)
    this.name = 'DishesFailure'
  }
}
