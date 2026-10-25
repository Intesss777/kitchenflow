import { z } from 'zod'

import { inventoryUnitSchema } from './inventory'
import { workspaceRoleSchema } from './workspace'

const quantitySchema = z.string().regex(/^\d+\.\d{3}$/)
const moneySchema = z.string().regex(/^\d+\.\d{2}$/)
const requestedQuantitySchema = z
  .string()
  .regex(/^\d{1,11}\.\d{3}$/)
  .refine((value) => Number(value) > 0, 'Quantity must be greater than zero')

export const purchaseDraftProductSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.string().nullable(),
    unit: inventoryUnitSchema,
    currentQuantity: quantitySchema,
    minimumQuantity: quantitySchema,
    unitCost: moneySchema.nullable(),
    isLowStock: z.boolean(),
  })
  .strict()

export const purchaseDraftItemSchema = z
  .object({
    productId: z.string().uuid(),
    name: z.string(),
    unit: inventoryUnitSchema,
    requestedQuantity: quantitySchema,
    lineCost: moneySchema.nullable(),
  })
  .strict()

export const purchaseDraftResponseSchema = z
  .object({
    workspace: z
      .object({
        organizationName: z.string(),
        branchName: z.string(),
        role: workspaceRoleSchema,
      })
      .strict(),
    note: z.string().nullable(),
    items: z.array(purchaseDraftItemSchema),
    products: z.array(purchaseDraftProductSchema),
    metrics: z
      .object({
        itemCount: z.number().int().nonnegative(),
        lowStockCount: z.number().int().nonnegative(),
        estimatedTotal: moneySchema.nullable(),
      })
      .strict(),
    updatedAt: z.string().datetime().nullable(),
  })
  .strict()

const purchaseDraftItemsSchema = z
  .array(
    z
      .object({
        productId: z.string().uuid(),
        requestedQuantity: requestedQuantitySchema,
      })
      .strict(),
  )
  .max(100)
  .superRefine((items, context) => {
    const ids = new Set<string>()
    items.forEach((item, index) => {
      if (ids.has(item.productId)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'productId'],
          message: 'A product can appear only once',
        })
      }
      ids.add(item.productId)
    })
  })

const purchaseDraftRequestShape = {
  note: z.union([z.string().trim().min(1).max(500), z.null()]).default(null),
  items: purchaseDraftItemsSchema,
}

export const savePurchaseDraftRequestSchema = z
  .object(purchaseDraftRequestShape)
  .strict()

export const preparePurchaseMessageRequestSchema = z
  .object({
    ...purchaseDraftRequestShape,
    includePrices: z.boolean().default(false),
  })
  .strict()

export const preparePurchaseMessageResponseSchema = z
  .object({
    message: z.string().min(1),
    whatsappUrl: z.url(),
  })
  .strict()

export type PurchaseDraftResponse = z.infer<typeof purchaseDraftResponseSchema>
export type PurchaseDraftProduct = z.infer<typeof purchaseDraftProductSchema>
export type PurchaseDraftItem = z.infer<typeof purchaseDraftItemSchema>
export type SavePurchaseDraftRequest = z.infer<typeof savePurchaseDraftRequestSchema>
export type PreparePurchaseMessageRequest = z.infer<typeof preparePurchaseMessageRequestSchema>
export type PreparePurchaseMessageResponse = z.infer<typeof preparePurchaseMessageResponseSchema>
