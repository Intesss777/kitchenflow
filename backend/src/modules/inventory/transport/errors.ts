import { AppError } from '../../../http/errors'
import { InventoryFailure } from '../domain/errors'

export async function executeInventory<Result>(operation: () => Promise<Result>) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof InventoryFailure)) throw error
    if (error.kind === 'conflict') {
      throw new AppError(409, 'CONFLICT', error.message)
    }
    if (error.kind === 'forbidden') {
      throw new AppError(403, 'FORBIDDEN', error.message)
    }
    throw new AppError(404, 'NOT_FOUND', error.message)
  }
}
