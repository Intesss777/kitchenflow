import {
  apiErrorSchema,
  createStaffEmployeeRequestSchema,
  createStaffEmployeeResponseSchema,
  createStaffEventRequestSchema,
  createStaffEventResponseSchema,
  staffEmployeeParamsSchema,
  staffOverviewQuerySchema,
  staffOverviewResponseSchema,
} from '@kitchenflow/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { StaffService } from '../application/staff-service'
import { executeStaff } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const security = [{ BearerAuth: [] }]

const overviewRoute = createRoute({
  method: 'get', path: '/', security,
  request: { query: staffOverviewQuerySchema },
  responses: {
    200: { content: { 'application/json': { schema: staffOverviewResponseSchema } }, description: 'Staff events for one month' },
    400: { content: errorContent, description: 'Invalid month' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Workspace not found' },
  },
})

const createEmployeeRoute = createRoute({
  method: 'post', path: '/employees', security,
  request: { body: { content: { 'application/json': { schema: createStaffEmployeeRequestSchema } } } },
  responses: {
    ...ingressErrorResponses,
    201: { content: { 'application/json': { schema: createStaffEmployeeResponseSchema } }, description: 'Created staff employee' },
    400: { content: errorContent, description: 'Invalid employee' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Workspace not found' },
  },
})

const createEventRoute = createRoute({
  method: 'post', path: '/employees/{employeeId}/events', security,
  request: {
    params: staffEmployeeParamsSchema,
    body: { content: { 'application/json': { schema: createStaffEventRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    201: { content: { 'application/json': { schema: createStaffEventResponseSchema } }, description: 'Created manual staff event' },
    400: { content: errorContent, description: 'Invalid event' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Employee not found' },
  },
})

export function createStaffRoutes(options: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireKitchen: MiddlewareHandler<AuthHttpEnv>
  service: StaffService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', options.requireAuth)
  routes.use('*', options.requireKitchen)
  routes.openapi(overviewRoute, async (c) =>
    c.json(await executeStaff(() => options.service.overview(c.var.user.id, c.req.valid('query').month)), 200))
  routes.openapi(createEmployeeRoute, async (c) =>
    c.json({ employee: await executeStaff(() => options.service.createEmployee(c.var.user.id, c.req.valid('json'))) }, 201))
  routes.openapi(createEventRoute, async (c) =>
    c.json({ event: await executeStaff(() => options.service.createEvent(
      c.var.user.id,
      c.req.valid('param').employeeId,
      c.req.valid('json'),
    )) }, 201))
  return routes
}
