import {
  apiErrorSchema,
  createInvoiceUploadRequestSchema,
  createInvoiceUploadResponseSchema,
  invoiceParamsSchema,
  purchaseInvoiceListResponseSchema,
  purchaseInvoiceListQuerySchema,
  purchaseInvoiceResponseSchema,
  updatePurchaseInvoiceRequestSchema,
} from '@kitchenflow/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { InvoicesService } from '../application/invoices-service'
import { executeInvoices } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  request: { query: purchaseInvoiceListQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: purchaseInvoiceListResponseSchema } },
      description: 'Purchase invoice workspace',
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Workspace not found' },
  },
})

const createUploadRoute = createRoute({
  method: 'post',
  path: '/uploads',
  security: bearerSecurity,
  request: {
    body: { content: { 'application/json': { schema: createInvoiceUploadRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    201: {
      content: { 'application/json': { schema: createInvoiceUploadResponseSchema } },
      description: 'Presigned invoice photo upload',
    },
    400: { content: errorContent, description: 'Invalid upload request' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Workspace not found' },
  },
})

const readRoute = createRoute({
  method: 'get',
  path: '/{invoiceId}',
  security: bearerSecurity,
  request: { params: invoiceParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: purchaseInvoiceResponseSchema } },
      description: 'Purchase invoice details',
    },
    400: { content: errorContent, description: 'Invalid invoice id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Invoice not found' },
  },
})

const finalizeRoute = createRoute({
  method: 'post',
  path: '/{invoiceId}/finalize',
  security: bearerSecurity,
  request: { params: invoiceParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: purchaseInvoiceResponseSchema } },
      description: 'Verified invoice photo with recognized draft',
    },
    400: { content: errorContent, description: 'Invalid invoice id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Invoice not found' },
    409: { content: errorContent, description: 'Upload incomplete or rejected' },
    410: { content: errorContent, description: 'Upload expired' },
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/{invoiceId}',
  security: bearerSecurity,
  request: {
    params: invoiceParamsSchema,
    body: { content: { 'application/json': { schema: updatePurchaseInvoiceRequestSchema } } },
  },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: purchaseInvoiceResponseSchema } },
      description: 'Reviewed purchase invoice',
    },
    400: { content: errorContent, description: 'Invalid review data' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Invoice, supplier, or product not found' },
    409: { content: errorContent, description: 'Invoice cannot be edited' },
  },
})

const confirmRoute = createRoute({
  method: 'post',
  path: '/{invoiceId}/confirm',
  security: bearerSecurity,
  request: { params: invoiceParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: purchaseInvoiceResponseSchema } },
      description: 'Confirmed invoice, stock receipt, and supplier debt',
    },
    400: { content: errorContent, description: 'Invalid invoice id' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Owner or administrator access required' },
    404: { content: errorContent, description: 'Invoice not found' },
    409: { content: errorContent, description: 'Invoice review is incomplete' },
  },
})

export function createInvoicesRoutes(options: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  requireFinance: MiddlewareHandler<AuthHttpEnv>
  service: InvoicesService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', options.requireAuth)
  routes.use('*', options.requireFinance)
  routes.openapi(listRoute, async (c) =>
    c.json(await executeInvoices(() => options.service.list(c.var.user.id, c.req.valid('query'))), 200))
  routes.openapi(createUploadRoute, async (c) =>
    c.json(await executeInvoices(() =>
      options.service.createUpload(c.var.user.id, c.req.valid('json')),
    ), 201))
  routes.openapi(readRoute, async (c) =>
    c.json(await executeInvoices(() =>
      options.service.invoice(c.var.user.id, c.req.valid('param').invoiceId),
    ), 200))
  routes.openapi(finalizeRoute, async (c) =>
    c.json(await executeInvoices(() =>
      options.service.finalize(c.var.user.id, c.req.valid('param').invoiceId),
    ), 200))
  routes.openapi(updateRoute, async (c) =>
    c.json(await executeInvoices(() =>
      options.service.update(
        c.var.user.id,
        c.req.valid('param').invoiceId,
        c.req.valid('json'),
      ),
    ), 200))
  routes.openapi(confirmRoute, async (c) =>
    c.json(await executeInvoices(() =>
      options.service.confirm(c.var.user.id, c.req.valid('param').invoiceId),
    ), 200))
  return routes
}
