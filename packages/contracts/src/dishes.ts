import { z } from 'zod'

import { inventoryUnitSchema, inventoryWorkspaceRoleSchema } from './inventory'
import { avatarContentTypeSchema, uploadTicketSchema } from './uploads'

export const DISH_PHOTO_MIN_BYTES = 64
export const DISH_PHOTO_MAX_BYTES = 10 * 1024 * 1024

const quantitySchema = z.string().regex(/^\d{1,11}\.\d{3}$/)
const positiveQuantitySchema = quantitySchema.refine(
  (value) => Number(value) > 0,
  'Quantity must be greater than zero',
)
const moneySchema = z.string().regex(/^\d{1,12}\.\d{2}$/)
const signedMoneySchema = z.string().regex(/^-?\d{1,12}\.\d{2}$/)
const optionalMoneySchema = z.union([
  moneySchema.refine((value) => Number(value) > 0, 'Price must be greater than zero'),
  z.null(),
])

export const dishIngredientInputSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: positiveQuantitySchema,
  })
  .strict()

export const saveDishCardRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    category: z.union([z.string().trim().min(1).max(80), z.null()]).default(null),
    sellingPrice: optionalMoneySchema.default(null),
    ingredients: z.array(dishIngredientInputSchema).min(1).max(30),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>()
    value.ingredients.forEach((ingredient, index) => {
      if (seen.has(ingredient.productId)) {
        context.addIssue({
          code: 'custom',
          path: ['ingredients', index, 'productId'],
          message: 'Each inventory product can appear only once',
        })
      }
      seen.add(ingredient.productId)
    })
  })

export const dishIngredientSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    name: z.string(),
    unit: inventoryUnitSchema,
    quantity: quantitySchema,
    costAmount: moneySchema.nullable(),
  })
  .strict()

export const dishCardSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.string().nullable(),
    photoUrl: z.union([z.string().startsWith('/'), z.string().url()]).nullable(),
    sellingPrice: moneySchema.nullable(),
    costPrice: moneySchema.nullable(),
    marginAmount: signedMoneySchema.nullable(),
    ingredients: z.array(dishIngredientSchema),
    updatedAt: z.string().datetime(),
  })
  .strict()

export const dishCardsOverviewResponseSchema = z
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
        activeDishes: z.number().int().nonnegative(),
        ingredientLinks: z.number().int().nonnegative(),
        averageFoodCostPercent: z.number().min(0).nullable(),
      })
      .strict(),
    products: z.array(
      z
        .object({
          id: z.string().uuid(),
          name: z.string(),
          unit: inventoryUnitSchema,
        })
        .strict(),
    ),
    dishes: z.array(dishCardSchema),
  })
  .strict()

export const dishCardParamsSchema = z.object({ dishId: z.string().uuid() }).strict()
export const dishPhotoParamsSchema = z
  .object({ dishId: z.string().uuid(), uploadId: z.string().uuid() })
  .strict()
export const dishCardResponseSchema = z.object({ dish: dishCardSchema }).strict()
export const createDishPhotoUploadRequestSchema = z
  .object({
    contentType: avatarContentTypeSchema,
    byteSize: z.number().int().min(DISH_PHOTO_MIN_BYTES).max(DISH_PHOTO_MAX_BYTES),
  })
  .strict()
export const createDishPhotoUploadResponseSchema = z.object({ upload: uploadTicketSchema }).strict()

export type DishCard = z.infer<typeof dishCardSchema>
export type DishCardsOverviewResponse = z.infer<typeof dishCardsOverviewResponseSchema>
export type SaveDishCardRequest = z.infer<typeof saveDishCardRequestSchema>
export type CreateDishPhotoUploadRequest = z.infer<typeof createDishPhotoUploadRequestSchema>
export type CreateDishPhotoUploadResponse = z.infer<typeof createDishPhotoUploadResponseSchema>
