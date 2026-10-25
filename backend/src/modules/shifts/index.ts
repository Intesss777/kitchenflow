import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import { createStorageObjectKey, type PrivateStorage } from '../../storage'
import type { AuthHttpEnv } from '../auth'
import { ShiftsService } from './application/shifts-service'
import { createPrismaShiftsRepository } from './infrastructure/shifts-repository'
import { createShiftsRoutes } from './transport/routes'

export function createShiftsModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireKitchen: MiddlewareHandler<AuthHttpEnv>
  storage: PrivateStorage
}) {
  const service = new ShiftsService({
    clock: { now: () => new Date() },
    objectKeys: {
      create: (now) => createStorageObjectKey({ namespace: 'sales-receipts', now }),
    },
    repository: createPrismaShiftsRepository(options.db),
    storage: options.storage,
  })
  return createShiftsRoutes({
    requireAuth: options.requireAuth,
    requireKitchen: options.requireKitchen,
    service,
  })
}
