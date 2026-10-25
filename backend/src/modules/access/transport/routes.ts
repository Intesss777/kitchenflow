import {
  apiErrorSchema,
  updateWorkspaceMemberRoleRequestSchema,
  updateWorkspaceMemberRoleResponseSchema,
  updateWorkspaceMemberBranchAccessRequestSchema,
  updateWorkspaceMemberBranchAccessResponseSchema,
  workspaceMemberParamsSchema,
  workspaceMembersQuerySchema,
  workspaceMembersResponseSchema,
} from '@kitchenflow/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { AccessService } from '../application/access-service'
import { executeAccess } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const security = [{ BearerAuth: [] }]

const listRoute = createRoute({
  method: 'get',
  path: '/members',
  security,
  request: { query: workspaceMembersQuerySchema },
  responses: {
    200: { content: { 'application/json': { schema: workspaceMembersResponseSchema } }, description: 'Organization access members' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner access required' },
  },
})

const updateRoleRoute = createRoute({
  method: 'patch',
  path: '/members/{membershipId}/role',
  security,
  request: {
    params: workspaceMemberParamsSchema,
    body: { content: { 'application/json': { schema: updateWorkspaceMemberRoleRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    200: { content: { 'application/json': { schema: updateWorkspaceMemberRoleResponseSchema } }, description: 'Updated organization membership role' },
    400: { content: errorContent, description: 'Invalid role' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner access required' },
    404: { content: errorContent, description: 'Member not found' },
    409: { content: errorContent, description: 'Owner role conflict' },
  },
})

const updateBranchAccessRoute = createRoute({
  method: 'patch',
  path: '/members/{membershipId}/branches',
  security,
  request: {
    params: workspaceMemberParamsSchema,
    body: {
      content: { 'application/json': { schema: updateWorkspaceMemberBranchAccessRequestSchema } },
    },
  },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: {
        'application/json': { schema: updateWorkspaceMemberBranchAccessResponseSchema },
      },
      description: 'Updated member branch access',
    },
    400: { content: errorContent, description: 'Invalid branch access' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner access required' },
    404: { content: errorContent, description: 'Member or branch not found' },
    409: { content: errorContent, description: 'Owner branch access conflict' },
  },
})

export function createAccessRoutes(options: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireOwner: MiddlewareHandler<AuthHttpEnv>
  service: AccessService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', options.requireAuth)
  routes.use('*', options.requireOwner)
  routes.openapi(listRoute, async (c) => c.json(await executeAccess(() =>
    options.service.listMembers(c.var.user.id, c.req.valid('query'))), 200))
  routes.openapi(updateRoleRoute, async (c) => c.json(await executeAccess(() =>
    options.service.updateMemberRole(
      c.var.user.id,
      c.req.valid('param').membershipId,
      c.req.valid('json'),
    )), 200))
  routes.openapi(updateBranchAccessRoute, async (c) => c.json(await executeAccess(() =>
    options.service.updateMemberBranchAccess(
      c.var.user.id,
      c.req.valid('param').membershipId,
      c.req.valid('json'),
    )), 200))
  return routes
}
