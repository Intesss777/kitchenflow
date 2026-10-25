import {
  apiErrorSchema,
  createSupplierLedgerEntryRequestSchema,
  createSupplierLedgerEntryResponseSchema,
  createSupplierRequestSchema,
  createSupplierResponseSchema,
  operationsDashboardQuerySchema,
  operationsDashboardResponseSchema,
  supplierDetailResponseSchema,
  supplierParamsSchema,
  updateSupplierRequestSchema,
  updateSupplierResponseSchema,
} from '@kitchenflow/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { AppError, validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { OperationsService } from '../application/operations-service'
import { executeOperations } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }

const dashboardRoute = createRoute({
  method: 'get',
  path: '/dashboard',
  security: [{ BearerAuth: [] }],
  request: { query: operationsDashboardQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: operationsDashboardResponseSchema } },
      description: 'Kitchen operations dashboard for the current organization',
    },
    401: {
      content: { 'application/json': { schema: apiErrorSchema } },
      description: 'Authentication required',
    },
    403: {
      content: { 'application/json': { schema: apiErrorSchema } },
      description: 'Owner access required',
    },
    404: {
      content: { 'application/json': { schema: apiErrorSchema } },
      description: 'Workspace not found',
    },
  },
})

const createSupplierRoute = createRoute({
  method: 'post',
  path: '/suppliers',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: createSupplierRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    201: {
      content: { 'application/json': { schema: createSupplierResponseSchema } },
      description: 'Created supplier',
    },
    400: { content: errorContent, description: 'Invalid supplier' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Workspace not found' },
    409: { content: errorContent, description: 'Supplier already exists' },
  },
})

const createLedgerEntryRoute = createRoute({
  method: 'post',
  path: '/suppliers/{supplierId}/entries',
  security: [{ BearerAuth: [] }],
  request: {
    params: supplierParamsSchema,
    body: {
      content: { 'application/json': { schema: createSupplierLedgerEntryRequestSchema } },
    },
  },
  responses: {
    ...ingressErrorResponses,
    201: {
      content: { 'application/json': { schema: createSupplierLedgerEntryResponseSchema } },
      description: 'Created supplier ledger entry',
    },
    400: { content: errorContent, description: 'Invalid ledger entry' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Supplier not found' },
  },
})

const updateSupplierRoute = createRoute({
  method: 'patch',
  path: '/suppliers/{supplierId}',
  security: [{ BearerAuth: [] }],
  request: {
    params: supplierParamsSchema,
    body: { content: { 'application/json': { schema: updateSupplierRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: updateSupplierResponseSchema } },
      description: 'Updated supplier',
    },
    400: { content: errorContent, description: 'Invalid supplier' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Supplier not found' },
    409: { content: errorContent, description: 'Supplier already exists' },
  },
})

const supplierDetailRoute = createRoute({
  method: 'get',
  path: '/suppliers/{supplierId}',
  security: [{ BearerAuth: [] }],
  request: { params: supplierParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: supplierDetailResponseSchema } },
      description: 'Supplier details and ledger',
    },
    400: { content: errorContent, description: 'Invalid supplier id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Supplier not found' },
  },
})

export function createOperationsRoutes(options: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireFinance: MiddlewareHandler<AuthHttpEnv>
  requireOwner: MiddlewareHandler<AuthHttpEnv>
  service: OperationsService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', options.requireAuth)
  routes.use('/dashboard', options.requireOwner)
  routes.use('/suppliers', options.requireFinance)
  routes.use('/suppliers/*', options.requireFinance)
  routes.openapi(dashboardRoute, async (c) => {
    const result = await options.service.dashboard(c.var.user.id, c.req.valid('query'))
    if (!result) {
      throw new AppError(404, 'NOT_FOUND', 'KitchenFlow workspace not found')
    }
    return c.json(result, 200)
  })
  routes.openapi(createSupplierRoute, async (c) => {
    const supplier = await executeOperations(() =>
      options.service.createSupplier(c.var.user.id, c.req.valid('json')),
    )
    return c.json({ supplier }, 201)
  })
  routes.openapi(updateSupplierRoute, async (c) => {
    const supplier = await executeOperations(() =>
      options.service.updateSupplier(
        c.var.user.id,
        c.req.valid('param').supplierId,
        c.req.valid('json'),
      ),
    )
    return c.json({ supplier }, 200)
  })
  routes.openapi(createLedgerEntryRoute, async (c) => {
    const entry = await executeOperations(() =>
      options.service.createLedgerEntry(
        c.var.user.id,
        c.req.valid('param').supplierId,
        c.req.valid('json'),
      ),
    )
    return c.json({ entry }, 201)
  })
  routes.openapi(supplierDetailRoute, async (c) => {
    const result = await executeOperations(() =>
      options.service.supplier(c.var.user.id, c.req.valid('param').supplierId),
    )
    return c.json(result, 200)
  })
  return routes
}
