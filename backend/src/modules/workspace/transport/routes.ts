import {
  apiErrorSchema,
  createWorkspaceBranchRequestSchema,
  switchWorkspaceBranchRequestSchema,
  switchWorkspaceBranchResponseSchema,
  updateWorkspaceBranchRequestSchema,
  updateWorkspaceBranchStatusRequestSchema,
  workspaceBranchParamsSchema,
  workspaceBranchResponseSchema,
  workspaceBranchesResponseSchema,
} from '@kitchenflow/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { WorkspaceService } from '../application/workspace-service'
import { executeWorkspace } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }

const switchBranchRoute = createRoute({
  method: 'patch',
  path: '/branch',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: switchWorkspaceBranchRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: switchWorkspaceBranchResponseSchema } },
      description: 'Active branch changed',
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Branch access required' },
    404: { content: errorContent, description: 'Branch not found' },
  },
})

const listBranchesRoute = createRoute({
  method: 'get',
  path: '/branches',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: workspaceBranchesResponseSchema } },
      description: 'Organization branches',
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner access required' },
  },
})

const createBranchRoute = createRoute({
  method: 'post',
  path: '/branches',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: createWorkspaceBranchRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    201: {
      content: { 'application/json': { schema: workspaceBranchResponseSchema } },
      description: 'Branch created',
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner access required' },
    409: { content: errorContent, description: 'Branch name conflict' },
  },
})

const updateBranchRoute = createRoute({
  method: 'patch',
  path: '/branches/{branchId}',
  security: [{ BearerAuth: [] }],
  request: {
    params: workspaceBranchParamsSchema,
    body: { content: { 'application/json': { schema: updateWorkspaceBranchRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: workspaceBranchResponseSchema } },
      description: 'Branch updated',
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner access required' },
    404: { content: errorContent, description: 'Branch not found' },
    409: { content: errorContent, description: 'Branch name conflict' },
  },
})

const updateBranchStatusRoute = createRoute({
  method: 'patch',
  path: '/branches/{branchId}/status',
  security: [{ BearerAuth: [] }],
  request: {
    params: workspaceBranchParamsSchema,
    body: {
      content: { 'application/json': { schema: updateWorkspaceBranchStatusRequestSchema } },
    },
  },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: workspaceBranchResponseSchema } },
      description: 'Branch status updated',
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner access required' },
    404: { content: errorContent, description: 'Branch not found' },
    409: { content: errorContent, description: 'Branch cannot be archived' },
  },
})

export function createWorkspaceRoutes(options: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireOwner: MiddlewareHandler<AuthHttpEnv>
  service: WorkspaceService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', options.requireAuth)
  routes.use('/branches', options.requireOwner)
  routes.use('/branches/*', options.requireOwner)
  routes.openapi(switchBranchRoute, async (c) => c.json(await executeWorkspace(() =>
    options.service.switchBranch(c.var.user.id, c.req.valid('json'))), 200))
  routes.openapi(listBranchesRoute, async (c) => c.json(await executeWorkspace(() =>
    options.service.listBranches(c.var.user.id)), 200))
  routes.openapi(createBranchRoute, async (c) => c.json(await executeWorkspace(() =>
    options.service.createBranch(c.var.user.id, c.req.valid('json'))), 201))
  routes.openapi(updateBranchRoute, async (c) => c.json(await executeWorkspace(() =>
    options.service.updateBranch(
      c.var.user.id,
      c.req.valid('param').branchId,
      c.req.valid('json'),
    )), 200))
  routes.openapi(updateBranchStatusRoute, async (c) => c.json(await executeWorkspace(() =>
    options.service.updateBranchStatus(
      c.var.user.id,
      c.req.valid('param').branchId,
      c.req.valid('json'),
    )), 200))
  return routes
}
