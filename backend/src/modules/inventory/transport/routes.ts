import {
  apiErrorSchema,
  archiveInventoryProductResponseSchema,
  createInventoryMovementRequestSchema,
  createInventoryMovementResponseSchema,
  createInventoryProductRequestSchema,
  createInventoryProductResponseSchema,
  inventoryOverviewResponseSchema,
  inventoryProductDetailResponseSchema,
  inventoryProductParamsSchema,
  updateInventoryProductRequestSchema,
  updateInventoryProductResponseSchema,
} from '@kitchenflow/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { InventoryService } from '../application/inventory-service'
import { executeInventory } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }

const overviewRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: inventoryOverviewResponseSchema } },
      description: 'Inventory overview for the active branch',
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Workspace membership required' },
    404: { content: errorContent, description: 'Workspace not found' },
  },
})

const createProductRoute = createRoute({
  method: 'post',
  path: '/products',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: createInventoryProductRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    201: {
      content: { 'application/json': { schema: createInventoryProductResponseSchema } },
      description: 'Created inventory product',
    },
    400: { content: errorContent, description: 'Invalid product' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Product management permission required' },
    404: { content: errorContent, description: 'Workspace not found' },
    409: { content: errorContent, description: 'Product already exists' },
  },
})

const productDetailRoute = createRoute({
  method: 'get',
  path: '/products/{productId}',
  security: [{ BearerAuth: [] }],
  request: { params: inventoryProductParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: inventoryProductDetailResponseSchema } },
      description: 'Inventory product and recent movements',
    },
    400: { content: errorContent, description: 'Invalid product id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Workspace membership required' },
    404: { content: errorContent, description: 'Product not found' },
  },
})

const updateProductRoute = createRoute({
  method: 'patch',
  path: '/products/{productId}',
  security: [{ BearerAuth: [] }],
  request: {
    params: inventoryProductParamsSchema,
    body: { content: { 'application/json': { schema: updateInventoryProductRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: updateInventoryProductResponseSchema } },
      description: 'Updated inventory product',
    },
    400: { content: errorContent, description: 'Invalid product' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Product management permission required' },
    404: { content: errorContent, description: 'Product not found' },
    409: { content: errorContent, description: 'Product name already exists' },
  },
})

const archiveProductRoute = createRoute({
  method: 'delete',
  path: '/products/{productId}',
  security: [{ BearerAuth: [] }],
  request: { params: inventoryProductParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: archiveInventoryProductResponseSchema } },
      description: 'Archived inventory product',
    },
    400: { content: errorContent, description: 'Invalid product id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Product management permission required' },
    404: { content: errorContent, description: 'Product not found' },
    409: { content: errorContent, description: 'Product is still in use' },
  },
})

const createMovementRoute = createRoute({
  method: 'post',
  path: '/products/{productId}/movements',
  security: [{ BearerAuth: [] }],
  request: {
    params: inventoryProductParamsSchema,
    body: {
      content: { 'application/json': { schema: createInventoryMovementRequestSchema } },
    },
  },
  responses: {
    ...ingressErrorResponses,
    201: {
      content: { 'application/json': { schema: createInventoryMovementResponseSchema } },
      description: 'Created inventory movement',
    },
    400: { content: errorContent, description: 'Invalid inventory movement' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Workspace membership required' },
    404: { content: errorContent, description: 'Product not found' },
    409: { content: errorContent, description: 'Insufficient stock' },
  },
})

export function createInventoryRoutes(options: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireWorkspace: MiddlewareHandler<AuthHttpEnv>
  service: InventoryService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', options.requireAuth)
  routes.use('*', options.requireWorkspace)
  routes.openapi(overviewRoute, async (c) => {
    const result = await executeInventory(() => options.service.overview(c.var.user.id))
    return c.json(result, 200)
  })
  routes.openapi(createProductRoute, async (c) => {
    const product = await executeInventory(() =>
      options.service.createProduct(c.var.user.id, c.req.valid('json')),
    )
    return c.json({ product }, 201)
  })
  routes.openapi(productDetailRoute, async (c) => {
    const result = await executeInventory(() =>
      options.service.product(c.var.user.id, c.req.valid('param').productId),
    )
    return c.json(result, 200)
  })
  routes.openapi(updateProductRoute, async (c) => {
    const product = await executeInventory(() =>
      options.service.updateProduct(
        c.var.user.id,
        c.req.valid('param').productId,
        c.req.valid('json'),
      ),
    )
    return c.json({ product }, 200)
  })
  routes.openapi(archiveProductRoute, async (c) => {
    await executeInventory(() =>
      options.service.archiveProduct(c.var.user.id, c.req.valid('param').productId),
    )
    return c.json({ archived: true as const }, 200)
  })
  routes.openapi(createMovementRoute, async (c) => {
    const result = await executeInventory(() =>
      options.service.createMovement(
        c.var.user.id,
        c.req.valid('param').productId,
        c.req.valid('json'),
      ),
    )
    return c.json(result, 201)
  })
  return routes
}
