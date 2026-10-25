export type OperationsFailureKind = 'conflict' | 'not_found'

export class OperationsFailure extends Error {
  constructor(
    readonly kind: OperationsFailureKind,
    message: string,
  ) {
    super(message)
    this.name = 'OperationsFailure'
  }
}
