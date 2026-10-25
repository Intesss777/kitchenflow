import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { AccessService } from './application/access-service'
import { createPrismaAccessRepository } from './infrastructure/access-repository'
import { createAccessRoutes } from './transport/routes'

export function createAccessModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireOwner: MiddlewareHandler<AuthHttpEnv>
}) {
  const service = new AccessService({
    clock: { now: () => new Date() },
    repository: createPrismaAccessRepository(options.db),
  })
  return createAccessRoutes({ ...options, service })
}
