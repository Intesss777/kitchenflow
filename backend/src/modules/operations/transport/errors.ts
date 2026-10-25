import { AppError } from '../../../http/errors'
import { OperationsFailure } from '../domain/errors'

export async function executeOperations<Result>(operation: () => Promise<Result>) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof OperationsFailure)) throw error
    if (error.kind === 'conflict') {
      throw new AppError(409, 'CONFLICT', error.message)
    }
    throw new AppError(404, 'NOT_FOUND', error.message)
  }
}
