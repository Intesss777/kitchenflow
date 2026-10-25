export type InvoicesFailureKind =
  | 'conflict'
  | 'expired'
  | 'not_found'
  | 'rejected'
  | 'upload_incomplete'

export class InvoicesFailure extends Error {
  constructor(
    readonly kind: InvoicesFailureKind,
    message: string,
  ) {
    super(message)
    this.name = 'InvoicesFailure'
  }
}
