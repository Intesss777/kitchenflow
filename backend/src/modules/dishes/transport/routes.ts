import {
  apiErrorSchema,
  createDishPhotoUploadRequestSchema,
  createDishPhotoUploadResponseSchema,
  dishCardParamsSchema,
  dishCardResponseSchema,
  dishCardsOverviewResponseSchema,
  dishPhotoParamsSchema,
  saveDishCardRequestSchema,
} from '@kitchenflow/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { DishesService } from '../application/dishes-service'
import { executeDishes } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const security = [{ BearerAuth: [] }]

const overviewRoute = createRoute({
  method: 'get', path: '/', security,
  responses: {
    200: { content: { 'application/json': { schema: dishCardsOverviewResponseSchema } }, description: 'Dish cards workspace' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Workspace not found' },
  },
})

const createRouteDefinition = createRoute({
  method: 'post', path: '/', security,
  request: { body: { content: { 'application/json': { schema: saveDishCardRequestSchema } } } },
  responses: {
    ...ingressErrorResponses,
    201: { content: { 'application/json': { schema: dishCardResponseSchema } }, description: 'Created dish card' },
    400: { content: errorContent, description: 'Invalid dish card' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Inventory product not found' },
    409: { content: errorContent, description: 'Dish already exists' },
  },
})

const updateRoute = createRoute({
  method: 'patch', path: '/{dishId}', security,
  request: {
    params: dishCardParamsSchema,
    body: { content: { 'application/json': { schema: saveDishCardRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    200: { content: { 'application/json': { schema: dishCardResponseSchema } }, description: 'Updated dish card' },
    400: { content: errorContent, description: 'Invalid dish card' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Dish or product not found' },
    409: { content: errorContent, description: 'Dish already exists' },
  },
})

const createPhotoUploadRoute = createRoute({
  method: 'post', path: '/{dishId}/photo/uploads', security,
  request: {
    params: dishCardParamsSchema,
    body: { content: { 'application/json': { schema: createDishPhotoUploadRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    201: { content: { 'application/json': { schema: createDishPhotoUploadResponseSchema } }, description: 'Presigned private dish photo upload' },
    400: { content: errorContent, description: 'Invalid photo upload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Dish not found' },
  },
})

const finalizePhotoRoute = createRoute({
  method: 'post', path: '/{dishId}/photo/uploads/{uploadId}/finalize', security,
  request: { params: dishPhotoParamsSchema },
  responses: {
    200: { content: { 'application/json': { schema: dishCardResponseSchema } }, description: 'Published private dish photo' },
    400: { content: errorContent, description: 'Invalid upload id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or chef access required' },
    404: { content: errorContent, description: 'Dish photo upload not found' },
    409: { content: errorContent, description: 'Photo incomplete or rejected' },
    410: { content: errorContent, description: 'Photo upload expired' },
  },
})

export function createDishesRoutes(options: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireKitchen: MiddlewareHandler<AuthHttpEnv>
  service: DishesService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', options.requireAuth)
  routes.use('*', options.requireKitchen)
  routes.openapi(overviewRoute, async (c) =>
    c.json(await executeDishes(() => options.service.overview(c.var.user.id)), 200))
  routes.openapi(createRouteDefinition, async (c) =>
    c.json({ dish: await executeDishes(() => options.service.create(c.var.user.id, c.req.valid('json'))) }, 201))
  routes.openapi(updateRoute, async (c) =>
    c.json({ dish: await executeDishes(() => options.service.update(
      c.var.user.id,
      c.req.valid('param').dishId,
      c.req.valid('json'),
    )) }, 200))
  routes.openapi(createPhotoUploadRoute, async (c) =>
    c.json(await executeDishes(() => options.service.createPhotoUpload(
      c.var.user.id,
      c.req.valid('param').dishId,
      c.req.valid('json'),
    )), 201))
  routes.openapi(finalizePhotoRoute, async (c) =>
    c.json({ dish: await executeDishes(() => options.service.finalizePhoto(
      c.var.user.id,
      c.req.valid('param').dishId,
      c.req.valid('param').uploadId,
    )) }, 200))
  return routes
}
