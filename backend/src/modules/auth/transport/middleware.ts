import type { WorkspaceRole } from '@kitchenflow/contracts'
import { createMiddleware } from 'hono/factory'

import { AppError } from '../../../http/errors'
import type { AuthenticatedPrincipal } from '../domain/user'
import { executeAuth } from './errors'

export type AuthHttpEnv = {
  Variables: {
    user: AuthenticatedPrincipal
  }
}

export function createRequireAuth(
  authenticate: (accessToken: string | undefined) => Promise<AuthenticatedPrincipal>,
) {
  return createMiddleware<AuthHttpEnv>(async (c, next) => {
    const accessToken = bearerToken(c.req.header('authorization'))
    const user = await executeAuth(() => authenticate(accessToken))
    c.set('user', user)
    await next()
  })
}

export function createRequireWorkspaceRole(...roles: ReadonlyArray<WorkspaceRole>) {
  return createMiddleware<AuthHttpEnv>(async (c, next) => {
    const workspaceRole = c.var.user.workspace?.role
    if (!workspaceRole || !roles.includes(workspaceRole)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this workspace')
    }
    await next()
  })
}

export function createRequireWorkspaceRoleOrUnscopedAdmin(
  ...roles: ReadonlyArray<WorkspaceRole>
) {
  return createMiddleware<AuthHttpEnv>(async (c, next) => {
    const workspaceRole = c.var.user.workspace?.role
    const allowed = workspaceRole
      ? roles.includes(workspaceRole)
      : c.var.user.role === 'admin'
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this workspace')
    }
    await next()
  })
}

function bearerToken(authorization: string | undefined) {
  if (!authorization?.startsWith('Bearer ')) return undefined
  return authorization.slice('Bearer '.length)
}
