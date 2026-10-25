import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { OperationsService } from './application/operations-service'
import { createPrismaOperationsRepository } from './infrastructure/operations-repository'
import { createOperationsRoutes } from './transport/routes'

export function createOperationsModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireFinance: MiddlewareHandler<AuthHttpEnv>
  requireOwner: MiddlewareHandler<AuthHttpEnv>
}) {
  const repository = createPrismaOperationsRepository(options.db)
  const service = new OperationsService({
    clock: { now: () => new Date() },
    dashboardReader: repository,
    suppliersRepository: repository,
  })
  return createOperationsRoutes({ ...options, service })
}
