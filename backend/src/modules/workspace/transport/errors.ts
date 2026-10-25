import { AppError } from '../../../http/errors'
import { WorkspaceFailure } from '../domain/errors'

export async function executeWorkspace<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof WorkspaceFailure)) throw error
    if (error.kind === 'forbidden') throw new AppError(403, 'FORBIDDEN', error.message)
    if (error.kind === 'conflict') throw new AppError(409, 'CONFLICT', error.message)
    throw new AppError(404, 'NOT_FOUND', error.message)
  }
}
