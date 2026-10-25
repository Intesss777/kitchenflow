import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { StaffService } from './application/staff-service'
import { createPrismaStaffRepository } from './infrastructure/staff-repository'
import { createStaffRoutes } from './transport/routes'

export function createStaffModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireKitchen: MiddlewareHandler<AuthHttpEnv>
}) {
  const service = new StaffService({
    clock: { now: () => new Date() },
    repository: createPrismaStaffRepository(options.db),
  })
  return createStaffRoutes({ ...options, service })
}
