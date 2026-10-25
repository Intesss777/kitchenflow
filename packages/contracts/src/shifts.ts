import { z } from 'zod'

import { inventoryUnitSchema, inventoryWorkspaceRoleSchema } from './inventory'
import { avatarContentTypeSchema, uploadTicketSchema } from './uploads'

export const SALES_RECEIPT_MIN_BYTES = 64
export const SALES_RECEIPT_MAX_BYTES = 15 * 1024 * 1024

const quantitySchema = z.string().regex(/^-?\d{1,11}\.\d{3}$/)
const positiveDishQuantitySchema = z.number().int().min(1).max(10_000)

export const salesShiftStatusSchema = z.enum(['review', 'confirmed'])
export const salesReceiptStatusSchema = z.enum(['upload_pending', 'recognized', 'rejected'])

export const salesShiftLineSchema = z.object({
  id: z.string().uuid(),
  dishId: z.string().uuid(),
  dishName: z.string(),
  quantity: positiveDishQuantitySchema,
}).strict()

export const salesShiftConsumptionSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  unit: inventoryUnitSchema,
  quantityBefore: quantitySchema,
  quantityUsed: quantitySchema,
  quantityAfter: quantitySchema,
}).strict()

export const salesReceiptSchema = z.object({
  id: z.string().uuid(),
  status: salesReceiptStatusSchema,
  recognitionConfidence: z.number().min(0).max(1).nullable(),
  imageUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
}).strict()

export const salesShiftSchema = z.object({
  id: z.string().uuid(),
  shiftDate: z.string().date(),
  status: salesShiftStatusSchema,
  recognitionMode: z.enum(['demo', 'provider']),
  createdByName: z.string(),
  confirmedByName: z.string().nullable(),
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
  receipts: z.array(salesReceiptSchema),
  lines: z.array(salesShiftLineSchema),
  consumption: z.array(salesShiftConsumptionSchema),
}).strict()

export const salesShiftSummarySchema = salesShiftSchema.pick({
  id: true,
  shiftDate: true,
  status: true,
  recognitionMode: true,
  createdByName: true,
  confirmedByName: true,
  createdAt: true,
  confirmedAt: true,
}).extend({
  receiptCount: z.number().int().nonnegative(),
  dishCount: z.number().int().nonnegative(),
}).strict()

export const salesShiftsOverviewResponseSchema = z.object({
  workspace: z.object({
    organizationName: z.string(),
    branchName: z.string(),
    role: inventoryWorkspaceRoleSchema,
    businessDate: z.string().date(),
  }).strict(),
  metrics: z.object({
    receiptsToday: z.number().int().nonnegative(),
    dishesToday: z.number().int().nonnegative(),
    needsReview: z.number().int().nonnegative(),
    confirmedThisMonth: z.number().int().nonnegative(),
  }).strict(),
  dishes: z.array(z.object({ id: z.string().uuid(), name: z.string() }).strict()),
  shifts: z.array(salesShiftSummarySchema),
}).strict()

export const salesShiftResponseSchema = z.object({ shift: salesShiftSchema }).strict()

export const createSalesReceiptUploadRequestSchema = z.object({
  shiftDate: z.string().date(),
  contentType: avatarContentTypeSchema,
  byteSize: z.number().int().min(SALES_RECEIPT_MIN_BYTES).max(SALES_RECEIPT_MAX_BYTES),
}).strict()

export const createSalesReceiptUploadResponseSchema = z.object({
  shiftId: z.string().uuid(),
  upload: uploadTicketSchema,
}).strict()

export const salesShiftParamsSchema = z.object({ shiftId: z.string().uuid() }).strict()
export const salesReceiptParamsSchema = z.object({ receiptId: z.string().uuid() }).strict()

export const updateSalesShiftRequestSchema = z.object({
  lines: z.array(z.object({
    dishId: z.string().uuid(),
    quantity: positiveDishQuantitySchema,
  }).strict()).min(1).max(100),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>()
  value.lines.forEach((line, index) => {
    if (seen.has(line.dishId)) {
      context.addIssue({
        code: 'custom',
        path: ['lines', index, 'dishId'],
        message: 'Each dish can appear only once',
      })
    }
    seen.add(line.dishId)
  })
})

export type SalesShift = z.infer<typeof salesShiftSchema>
export type SalesShiftsOverviewResponse = z.infer<typeof salesShiftsOverviewResponseSchema>
export type CreateSalesReceiptUploadRequest = z.infer<typeof createSalesReceiptUploadRequestSchema>
export type CreateSalesReceiptUploadResponse = z.infer<typeof createSalesReceiptUploadResponseSchema>
export type UpdateSalesShiftRequest = z.infer<typeof updateSalesShiftRequestSchema>

