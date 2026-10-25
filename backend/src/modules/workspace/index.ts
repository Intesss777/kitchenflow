import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { WorkspaceService } from './application/workspace-service'
import {
  createPrismaWorkspaceRepository,
  activeWorkspaceDto,
  resolveActiveWorkspace,
  type ResolvedWorkspace,
} from './infrastructure/workspace-repository'
import { createWorkspaceRoutes } from './transport/routes'

export function createWorkspaceModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireOwner: MiddlewareHandler<AuthHttpEnv>
}) {
  const service = new WorkspaceService(createPrismaWorkspaceRepository(options.db))
  return createWorkspaceRoutes({
    requireAuth: options.requireAuth,
    requireOwner: options.requireOwner,
    service,
  })
}

export { activeWorkspaceDto, resolveActiveWorkspace }
export type { ResolvedWorkspace }
