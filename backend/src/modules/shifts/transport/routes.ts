import {
  apiErrorSchema,
  createSalesReceiptUploadRequestSchema,
  createSalesReceiptUploadResponseSchema,
  salesReceiptParamsSchema,
  salesShiftParamsSchema,
  salesShiftResponseSchema,
  salesShiftsOverviewResponseSchema,
  updateSalesShiftRequestSchema,
} from '@kitchenflow/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { ShiftsService } from '../application/shifts-service'
import { executeShifts } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const listRoute = createRoute({
  method: 'get', path: '/', security: bearerSecurity,
  responses: {
    200: { content: { 'application/json': { schema: salesShiftsOverviewResponseSchema } }, description: 'Sales shifts workspace' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Workspace not found' },
  },
})

const createUploadRoute = createRoute({
  method: 'post', path: '/uploads', security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createSalesReceiptUploadRequestSchema } } } },
  responses: {
    ...ingressErrorResponses,
    201: { content: { 'application/json': { schema: createSalesReceiptUploadResponseSchema } }, description: 'Presigned receipt photo upload' },
    400: { content: errorContent, description: 'Invalid upload request' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    409: { content: errorContent, description: 'Shift already confirmed' },
  },
})

const finalizeRoute = createRoute({
  method: 'post', path: '/receipts/{receiptId}/finalize', security: bearerSecurity,
  request: { params: salesReceiptParamsSchema },
  responses: {
    200: { content: { 'application/json': { schema: salesShiftResponseSchema } }, description: 'Recognized receipt added to the shift draft' },
    400: { content: errorContent, description: 'Invalid receipt id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Receipt not found' },
    409: { content: errorContent, description: 'Upload incomplete or rejected' },
    410: { content: errorContent, description: 'Upload expired' },
  },
})

const readRoute = createRoute({
  method: 'get', path: '/{shiftId}', security: bearerSecurity,
  request: { params: salesShiftParamsSchema },
  responses: {
    200: { content: { 'application/json': { schema: salesShiftResponseSchema } }, description: 'Sales shift details' },
    400: { content: errorContent, description: 'Invalid shift id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Shift not found' },
  },
})

const updateRoute = createRoute({
  method: 'patch', path: '/{shiftId}', security: bearerSecurity,
  request: {
    params: salesShiftParamsSchema,
    body: { content: { 'application/json': { schema: updateSalesShiftRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    200: { content: { 'application/json': { schema: salesShiftResponseSchema } }, description: 'Reviewed dish quantities' },
    400: { content: errorContent, description: 'Invalid review' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Shift or dish not found' },
    409: { content: errorContent, description: 'Shift cannot be edited' },
  },
})

const confirmRoute = createRoute({
  method: 'post', path: '/{shiftId}/confirm', security: bearerSecurity,
  request: { params: salesShiftParamsSchema },
  responses: {
    ...ingressErrorResponses,
    200: { content: { 'application/json': { schema: salesShiftResponseSchema } }, description: 'Confirmed shift with posted inventory write-offs' },
    400: { content: errorContent, description: 'Invalid shift id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Shift not found' },
    409: { content: errorContent, description: 'Shift is incomplete or stock is insufficient' },
  },
})

export function createShiftsRoutes(options: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireKitchen: MiddlewareHandler<AuthHttpEnv>
  service: ShiftsService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', options.requireAuth)
  routes.use('*', options.requireKitchen)
  routes.openapi(listRoute, async (c) => c.json(await executeShifts(() => options.service.list(c.var.user.id)), 200))
  routes.openapi(createUploadRoute, async (c) => c.json(await executeShifts(() => options.service.createUpload(c.var.user.id, c.req.valid('json'))), 201))
  routes.openapi(finalizeRoute, async (c) => c.json(await executeShifts(() => options.service.finalize(c.var.user.id, c.req.valid('param').receiptId)), 200))
  routes.openapi(readRoute, async (c) => c.json(await executeShifts(() => options.service.shift(c.var.user.id, c.req.valid('param').shiftId)), 200))
  routes.openapi(updateRoute, async (c) => c.json(await executeShifts(() => options.service.update(c.var.user.id, c.req.valid('param').shiftId, c.req.valid('json'))), 200))
  routes.openapi(confirmRoute, async (c) => c.json(await executeShifts(() => options.service.confirm(c.var.user.id, c.req.valid('param').shiftId)), 200))
  return routes
}
