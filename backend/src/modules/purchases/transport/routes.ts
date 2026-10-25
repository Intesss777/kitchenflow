import {
  apiErrorSchema,
  preparePurchaseMessageRequestSchema,
  preparePurchaseMessageResponseSchema,
  purchaseDraftResponseSchema,
  savePurchaseDraftRequestSchema,
} from '@kitchenflow/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { PurchasesService } from '../application/purchases-service'
import { executePurchases } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }

const draftRoute = createRoute({
  method: 'get',
  path: '/draft',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: purchaseDraftResponseSchema } },
      description: 'Shared purchase draft for the active branch',
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Workspace membership required' },
    404: { content: errorContent, description: 'Workspace not found' },
  },
})

const saveDraftRoute = createRoute({
  method: 'put',
  path: '/draft',
  security: [{ BearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: savePurchaseDraftRequestSchema } } } },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: purchaseDraftResponseSchema } },
      description: 'Saved purchase draft',
    },
    400: { content: errorContent, description: 'Invalid purchase draft' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Workspace membership required' },
    404: { content: errorContent, description: 'Workspace or product not found' },
  },
})

const prepareRoute = createRoute({
  method: 'post',
  path: '/draft/prepare',
  security: [{ BearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: preparePurchaseMessageRequestSchema } } } },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: preparePurchaseMessageResponseSchema } },
      description: 'Prepared purchase message and optional WhatsApp URL',
    },
    400: { content: errorContent, description: 'Invalid purchase draft' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Workspace membership required' },
    404: { content: errorContent, description: 'Workspace or product not found' },
    409: { content: errorContent, description: 'Products are missing' },
  },
})

export function createPurchasesRoutes(options: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireWorkspace: MiddlewareHandler<AuthHttpEnv>
  service: PurchasesService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', options.requireAuth)
  routes.use('*', options.requireWorkspace)
  routes.openapi(draftRoute, async (c) => {
    const draft = await executePurchases(() => options.service.draft(c.var.user.id))
    return c.json(draft, 200)
  })
  routes.openapi(saveDraftRoute, async (c) => {
    const draft = await executePurchases(() =>
      options.service.saveDraft(c.var.user.id, c.req.valid('json')),
    )
    return c.json(draft, 200)
  })
  routes.openapi(prepareRoute, async (c) => {
    const result = await executePurchases(() =>
      options.service.prepareMessage(c.var.user.id, c.req.valid('json')),
    )
    return c.json(result, 200)
  })
  return routes
}
