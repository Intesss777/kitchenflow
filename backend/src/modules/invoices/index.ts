import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import { createStorageObjectKey, type PrivateStorage } from '../../storage'
import type { AuthHttpEnv } from '../auth'
import { InvoicesService } from './application/invoices-service'
import { createPrismaInvoicesRepository } from './infrastructure/invoices-repository'
import { createInvoicesRoutes } from './transport/routes'

export function createInvoicesModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireFinance: MiddlewareHandler<AuthHttpEnv>
  storage: PrivateStorage
}) {
  const repository = createPrismaInvoicesRepository(options.db)
  const service = new InvoicesService({
    clock: { now: () => new Date() },
    objectKeys: {
      create: (now) => createStorageObjectKey({ namespace: 'purchase-invoices', now }),
    },
    repository,
    storage: options.storage,
  })
  return createInvoicesRoutes({
    requireAuth: options.requireAuth,
    requireFinance: options.requireFinance,
    service,
  })
}
