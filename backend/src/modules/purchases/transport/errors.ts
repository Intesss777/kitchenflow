import { AppError } from '../../../http/errors'
import { PurchasesFailure } from '../domain/errors'

export async function executePurchases<Result>(operation: () => Promise<Result>) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof PurchasesFailure)) throw error
    if (error.kind === 'conflict') {
      throw new AppError(409, 'CONFLICT', error.message)
    }
    throw new AppError(404, 'NOT_FOUND', error.message)
  }
}
