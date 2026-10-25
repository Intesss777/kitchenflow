import { AppError } from '../../../http/errors'
import { StaffFailure } from '../domain/errors'

export async function executeStaff<Result>(operation: () => Promise<Result>) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof StaffFailure)) throw error
    throw new AppError(404, 'NOT_FOUND', error.message)
  }
}
