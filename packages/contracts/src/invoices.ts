import { z } from 'zod'

import { inventoryUnitSchema } from './inventory'
import { avatarContentTypeSchema, uploadTicketSchema } from './uploads'
import { workspaceRoleSchema } from './workspace'

export const INVOICE_MIN_BYTES = 64
export const INVOICE_MAX_BYTES = 15 * 1024 * 1024
export const invoiceContentTypeSchema = avatarContentTypeSchema
export const purchaseInvoiceStatusSchema = z.enum([
  'upload_pending',
  'review',
  'confirmed',
  'rejected',
])
export const invoiceRecognitionModeSchema = z.enum(['demo', 'provider'])

const quantitySchema = z.string().regex(/^\d{1,11}\.\d{3}$/)
const positiveQuantitySchema = quantitySchema.refine(
  (value) => Number(value) > 0,
  'Quantity must be greater than zero',
)
const moneySchema = z.string().regex(/^\d{1,12}\.\d{2}$/)
const positiveMoneySchema = moneySchema.refine(
  (value) => Number(value) > 0,
  'Price must be greater than zero',
)

export const purchaseInvoiceItemSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().uuid().nullable(),
    detectedName: z.string(),
    unit: inventoryUnitSchema,
    quantity: quantitySchema,
    unitPrice: moneySchema,
    lineTotal: moneySchema,
  })
  .strict()

export const purchaseInvoiceSchema = z
  .object({
    id: z.string().uuid(),
    branchId: z.string().uuid(),
    status: purchaseInvoiceStatusSchema,
    recognitionMode: invoiceRecognitionModeSchema,
    recognitionConfidence: z.number().min(0).max(1).nullable(),
    supplierId: z.string().uuid().nullable(),
    supplierName: z.string().nullable(),
    invoiceNumber: z.string().nullable(),
    invoiceDate: z.string().date().nullable(),
    dueAt: z.string().date().nullable(),
    totalAmount: moneySchema.nullable(),
    imageUrl: z.string().url().nullable(),
    createdByName: z.string(),
    confirmedByName: z.string().nullable(),
    createdAt: z.string().datetime(),
    confirmedAt: z.string().datetime().nullable(),
    items: z.array(purchaseInvoiceItemSchema),
  })
  .strict()

export const createInvoiceUploadRequestSchema = z
  .object({
    contentType: invoiceContentTypeSchema,
    byteSize: z.number().int().min(INVOICE_MIN_BYTES).max(INVOICE_MAX_BYTES),
  })
  .strict()

export const createInvoiceUploadResponseSchema = z
  .object({ upload: uploadTicketSchema })
  .strict()

export const invoiceParamsSchema = z.object({ invoiceId: z.string().uuid() }).strict()

export const purchaseInvoiceResponseSchema = z
  .object({ invoice: purchaseInvoiceSchema })
  .strict()

export const updatePurchaseInvoiceRequestSchema = z
  .object({
    supplierId: z.string().uuid(),
    invoiceNumber: z.string().trim().min(1).max(120),
    invoiceDate: z.string().date(),
    dueAt: z.string().date(),
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid().nullable(),
            detectedName: z.string().trim().min(1).max(160),
            unit: inventoryUnitSchema,
            quantity: positiveQuantitySchema,
            unitPrice: positiveMoneySchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.dueAt < value.invoiceDate) {
      context.addIssue({
        code: 'custom',
        path: ['dueAt'],
        message: 'Due date cannot be earlier than invoice date',
      })
    }
  })

export const invoiceListItemSchema = purchaseInvoiceSchema.omit({
  imageUrl: true,
  items: true,
})

const invoiceListDateSchema = z.string().date()

export const purchaseInvoiceListQuerySchema = z
  .object({
    from: invoiceListDateSchema.optional(),
    to: invoiceListDateSchema.optional(),
    q: z.string().trim().max(120).optional(),
    supplierId: z.string().uuid().optional(),
    status: z.enum(['review', 'confirmed', 'rejected']).optional(),
    page: z.coerce.number().int().positive().max(10_000).default(1),
    pageSize: z.coerce.number().int().positive().max(500).default(200),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.from === undefined) !== (value.to === undefined)) {
      context.addIssue({ code: 'custom', message: 'Both invoice range dates are required together' })
      return
    }
    if (value.from && value.to && value.to < value.from) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'End date must not precede start date' })
    }
  })

export const purchaseInvoiceListResponseSchema = z
  .object({
    workspace: z
      .object({
        organizationName: z.string(),
        branchName: z.string(),
        role: workspaceRoleSchema,
      })
      .strict(),
    metrics: z
      .object({
        needsReview: z.number().int().nonnegative(),
        confirmedThisMonth: z.number().int().nonnegative(),
        amountThisMonth: moneySchema,
      })
      .strict(),
    suppliers: z.array(z.object({ id: z.string().uuid(), name: z.string() }).strict()),
    products: z.array(
      z
        .object({
          id: z.string().uuid(),
          name: z.string(),
          unit: inventoryUnitSchema,
        })
        .strict(),
    ),
    invoices: z.array(invoiceListItemSchema),
    pagination: z
      .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive().max(500),
        total: z.number().int().nonnegative(),
        hasNext: z.boolean(),
      })
      .strict(),
  })
  .strict()

export type PurchaseInvoice = z.infer<typeof purchaseInvoiceSchema>
export type PurchaseInvoiceItem = z.infer<typeof purchaseInvoiceItemSchema>
export type CreateInvoiceUploadRequest = z.infer<typeof createInvoiceUploadRequestSchema>
export type CreateInvoiceUploadResponse = z.infer<typeof createInvoiceUploadResponseSchema>
export type UpdatePurchaseInvoiceRequest = z.infer<typeof updatePurchaseInvoiceRequestSchema>
export type PurchaseInvoiceResponse = z.infer<typeof purchaseInvoiceResponseSchema>
export type PurchaseInvoiceListResponse = z.infer<typeof purchaseInvoiceListResponseSchema>
export type PurchaseInvoiceListQuery = z.infer<typeof purchaseInvoiceListQuerySchema>
