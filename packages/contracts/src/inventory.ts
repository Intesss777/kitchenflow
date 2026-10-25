import { z } from 'zod'

import { workspaceRoleSchema } from './workspace'

export const inventoryUnitSchema = z.enum([
  'kilogram',
  'gram',
  'liter',
  'milliliter',
  'piece',
])
export const inventoryMovementTypeSchema = z.enum(['receipt', 'writeoff', 'stocktake'])
export const inventoryWorkspaceRoleSchema = workspaceRoleSchema

const quantitySchema = z.string().regex(/^-?\d+\.\d{3}$/)
const movementQuantitySchema = z
  .string()
  .regex(/^\d{1,11}\.\d{3}$/)
const moneySchema = z.string().regex(/^\d+\.\d{2}$/)
const positiveMoneySchema = z
  .string()
  .regex(/^\d{1,12}\.\d{2}$/)
  .refine((value) => Number(value) > 0, 'Cost must be greater than zero')
const optionalNullableText = (maximum: number) =>
  z.union([z.string().trim().min(1).max(maximum), z.null()]).optional().default(null)

export const inventoryProductSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.string().nullable(),
    unit: inventoryUnitSchema,
    quantity: quantitySchema,
    minimumQuantity: quantitySchema,
    unitCost: moneySchema.nullable(),
    isLowStock: z.boolean(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export const inventoryMovementSchema = z
  .object({
    id: z.string().uuid(),
    type: inventoryMovementTypeSchema,
    quantityDelta: quantitySchema,
    resultingQuantity: quantitySchema,
    unitCost: moneySchema.nullable(),
    occurredAt: z.string().datetime(),
    reference: z.string().nullable(),
    note: z.string().nullable(),
    createdByName: z.string(),
  })
  .strict()

export const inventoryOverviewResponseSchema = z
  .object({
    workspace: z
      .object({
        organizationName: z.string(),
        branchName: z.string(),
        role: inventoryWorkspaceRoleSchema,
      })
      .strict(),
    metrics: z
      .object({
        activeProducts: z.number().int().nonnegative(),
        lowStockProducts: z.number().int().nonnegative(),
        receiptsToday: z.number().int().nonnegative(),
        stockValue: moneySchema.nullable(),
      })
      .strict(),
    products: z.array(inventoryProductSchema),
  })
  .strict()

export const createInventoryProductRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    category: optionalNullableText(80),
    unit: inventoryUnitSchema,
    minimumQuantity: z.string().regex(/^\d{1,11}\.\d{3}$/),
    unitCost: z.union([positiveMoneySchema, z.null()]).optional().default(null),
  })
  .strict()

export const createInventoryProductResponseSchema = z
  .object({ product: inventoryProductSchema })
  .strict()

export const updateInventoryProductRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    category: optionalNullableText(80),
    minimumQuantity: z.string().regex(/^\d{1,11}\.\d{3}$/),
    unitCost: z.union([positiveMoneySchema, z.null()]).optional().default(null),
  })
  .strict()

export const updateInventoryProductResponseSchema = z
  .object({ product: inventoryProductSchema })
  .strict()

export const archiveInventoryProductResponseSchema = z
  .object({ archived: z.literal(true) })
  .strict()

export const inventoryProductParamsSchema = z
  .object({ productId: z.string().uuid() })
  .strict()

export const createInventoryMovementRequestSchema = z
  .object({
    type: inventoryMovementTypeSchema,
    quantity: movementQuantitySchema,
    unitCost: z.union([positiveMoneySchema, z.null()]).optional().default(null),
    occurredAt: z.string().datetime(),
    reference: optionalNullableText(120),
    note: optionalNullableText(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type !== 'stocktake' && Number(value.quantity) <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Quantity must be greater than zero',
      })
    }
  })

export const createInventoryMovementResponseSchema = z
  .object({ movement: inventoryMovementSchema, product: inventoryProductSchema })
  .strict()

export const inventoryProductDetailResponseSchema = z
  .object({
    product: inventoryProductSchema,
    movements: z.array(inventoryMovementSchema),
  })
  .strict()

export type InventoryUnit = z.infer<typeof inventoryUnitSchema>
export type InventoryMovementType = z.infer<typeof inventoryMovementTypeSchema>
export type InventoryProduct = z.infer<typeof inventoryProductSchema>
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>
export type InventoryOverviewResponse = z.infer<typeof inventoryOverviewResponseSchema>
export type CreateInventoryProductRequest = z.infer<typeof createInventoryProductRequestSchema>
export type CreateInventoryProductResponse = z.infer<typeof createInventoryProductResponseSchema>
export type UpdateInventoryProductRequest = z.infer<typeof updateInventoryProductRequestSchema>
export type UpdateInventoryProductResponse = z.infer<typeof updateInventoryProductResponseSchema>
export type ArchiveInventoryProductResponse = z.infer<typeof archiveInventoryProductResponseSchema>
export type CreateInventoryMovementRequest = z.infer<typeof createInventoryMovementRequestSchema>
export type CreateInventoryMovementResponse = z.infer<typeof createInventoryMovementResponseSchema>
export type InventoryProductDetailResponse = z.infer<typeof inventoryProductDetailResponseSchema>
