export type ShiftsFailureKind =
  | 'conflict'
  | 'expired'
  | 'not_found'
  | 'rejected'
  | 'upload_incomplete'

export class ShiftsFailure extends Error {
  constructor(
    readonly kind: ShiftsFailureKind,
    message: string,
  ) {
    super(message)
    this.name = 'ShiftsFailure'
  }
}
