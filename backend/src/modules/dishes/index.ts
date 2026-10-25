import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import { createStorageObjectKey, type PrivateStorage } from '../../storage'
import type { AuthHttpEnv } from '../auth'
import { DishesService } from './application/dishes-service'
import { createPrismaDishesRepository } from './infrastructure/dishes-repository'
import { createDishesRoutes } from './transport/routes'

export function createDishesModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireKitchen: MiddlewareHandler<AuthHttpEnv>
  storage: PrivateStorage
}) {
  const repository = createPrismaDishesRepository(options.db, options.storage)
  const service = new DishesService({
    clock: { now: () => new Date() },
    objectKeys: { create: (now) => createStorageObjectKey({ namespace: 'dish-photos', now }) },
    repository,
    storage: options.storage,
  })
  return createDishesRoutes({ ...options, service })
}
