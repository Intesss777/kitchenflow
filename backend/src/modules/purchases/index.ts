import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { PurchasesService } from './application/purchases-service'
import { createPrismaPurchaseDraftRepository } from './infrastructure/purchases-repository'
import { createPurchasesRoutes } from './transport/routes'

export function createPurchasesModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireWorkspace: MiddlewareHandler<AuthHttpEnv>
}) {
  const repository = createPrismaPurchaseDraftRepository(options.db)
  const service = new PurchasesService(repository)
  return createPurchasesRoutes({ ...options, service })
}
