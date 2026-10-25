import { AppError } from '../../../http/errors'
import { AccessFailure } from '../domain/errors'

export async function executeAccess<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof AccessFailure)) throw error
    if (error.kind === 'forbidden') throw new AppError(403, 'FORBIDDEN', error.message)
    if (error.kind === 'not_found') throw new AppError(404, 'NOT_FOUND', error.message)
    throw new AppError(409, 'CONFLICT', error.message)
  }
}
