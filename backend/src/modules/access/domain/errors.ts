export class AccessFailure extends Error {
  constructor(
    readonly kind: 'forbidden' | 'not_found' | 'role_conflict',
    message: string,
  ) {
    super(message)
  }
}
