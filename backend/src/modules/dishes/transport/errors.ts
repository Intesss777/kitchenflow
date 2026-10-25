import { AppError } from '../../../http/errors'
import { DishesFailure } from '../domain/errors'

export async function executeDishes<Result>(operation: () => Promise<Result>) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof DishesFailure)) throw error
    if (error.kind === 'conflict') throw new AppError(409, 'CONFLICT', error.message)
    if (error.kind === 'expired') throw new AppError(410, 'UPLOAD_EXPIRED', error.message)
    if (error.kind === 'rejected') throw new AppError(409, 'UPLOAD_REJECTED', error.message)
    if (error.kind === 'upload_incomplete') throw new AppError(409, 'UPLOAD_NOT_COMPLETED', error.message)
    throw new AppError(404, 'NOT_FOUND', error.message)
  }
}
