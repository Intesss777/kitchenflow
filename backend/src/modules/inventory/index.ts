import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { InventoryService } from './application/inventory-service'
import { createPrismaInventoryRepository } from './infrastructure/inventory-repository'
import { createInventoryRoutes } from './transport/routes'

export function createInventoryModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireWorkspace: MiddlewareHandler<AuthHttpEnv>
}) {
  const repository = createPrismaInventoryRepository(options.db)
  const service = new InventoryService({
    clock: { now: () => new Date() },
    repository,
  })
  return createInventoryRoutes({ ...options, service })
}
