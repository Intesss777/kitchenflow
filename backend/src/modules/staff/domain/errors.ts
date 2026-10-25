export class StaffFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StaffFailure'
  }
}
