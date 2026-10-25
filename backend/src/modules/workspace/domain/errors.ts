export class WorkspaceFailure extends Error {
  constructor(
    readonly kind: 'conflict' | 'forbidden' | 'not_found',
    message: string,
  ) {
    super(message)
  }
}
