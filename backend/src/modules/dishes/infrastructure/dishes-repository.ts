import type {
  DishCard,
  DishCardsOverviewResponse,
  SaveDishCardRequest,
} from '@kitchenflow/contracts'

import type { DbClient } from '../../../db'
import { Prisma, type WorkspaceRole } from '../../../generated/prisma/client'
import { resolveActiveWorkspace } from '../../workspace'
import type { DishesRepository, PrivateStorage } from '../application/ports'
import { DishesFailure } from '../domain/errors'

export function createPrismaDishesRepository(
  db: DbClient,
  storage: PrivateStorage,
): DishesRepository {
  return {
    async overview(userId) {
      const workspace = await workspaceContext(db, userId)
      const [dishes, products] = await db.$transaction([
        db.dishCard.findMany({
          where: { branchId: workspace.branchId, isActive: true },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
          select: dishFields,
        }),
        db.inventoryProduct.findMany({
          where: { organizationId: workspace.organizationId, isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, unit: true },
        }),
      ])
      const costVisible = canSeeCost(workspace.role)
      const dishDtos = await Promise.all(dishes.map((dish) => dishDto(dish, costVisible, storage)))
      const ratios = dishDtos.flatMap((dish) =>
        dish.sellingPrice && dish.costPrice && Number(dish.sellingPrice) > 0
          ? [(Number(dish.costPrice) / Number(dish.sellingPrice)) * 100]
          : [],
      )
      return {
        workspace: {
          organizationName: workspace.organizationName,
          branchName: workspace.branchName,
          role: workspace.role,
        },
        metrics: {
          activeDishes: dishDtos.length,
          ingredientLinks: dishDtos.reduce((sum, dish) => sum + dish.ingredients.length, 0),
          averageFoodCostPercent: costVisible && ratios.length
            ? Math.round((ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length) * 10) / 10
            : null,
        },
        products,
        dishes: dishDtos,
      } satisfies DishCardsOverviewResponse
    },

    async create(userId, input) {
      const workspace = await workspaceContext(db, userId)
      try {
        const result = await db.$transaction(async (tx) => {
          await assertProducts(tx, workspace.organizationId, input)
          return tx.dishCard.create({
            data: {
              organizationId: workspace.organizationId,
              branchId: workspace.branchId,
              createdByUserId: userId,
              name: input.name,
              category: input.category,
              sellingPrice: canSeeCost(workspace.role) ? input.sellingPrice : null,
              ingredients: {
                create: input.ingredients.map((ingredient, position) => ({
                  ...ingredient,
                  position,
                })),
              },
            },
            select: dishFields,
          })
        })
        return await dishDto(result, canSeeCost(workspace.role), storage)
      } catch (error) {
        throwDishConflict(error)
      }
    },

    async update(userId, dishId, input) {
      const workspace = await workspaceContext(db, userId)
      try {
        const result = await db.$transaction(async (tx) => {
          const existing = await tx.dishCard.findFirst({
            where: { id: dishId, branchId: workspace.branchId, isActive: true },
            select: { id: true, sellingPrice: true },
          })
          if (!existing) throw new DishesFailure('not_found', 'Карточка блюда не найдена')
          await assertProducts(tx, workspace.organizationId, input)
          return tx.dishCard.update({
            where: { id: dishId },
            data: {
              name: input.name,
              category: input.category,
              sellingPrice: canSeeCost(workspace.role) ? input.sellingPrice : existing.sellingPrice,
              ingredients: {
                deleteMany: {},
                create: input.ingredients.map((ingredient, position) => ({
                  ...ingredient,
                  position,
                })),
              },
            },
            select: dishFields,
          })
        })
        return await dishDto(result, canSeeCost(workspace.role), storage)
      } catch (error) {
        throwDishConflict(error)
      }
    },

    async createPhotoUpload(input) {
      const workspace = await workspaceContext(db, input.userId)
      const dish = await db.dishCard.findFirst({
        where: { id: input.dishId, branchId: workspace.branchId, isActive: true },
        select: { id: true },
      })
      if (!dish) throw new DishesFailure('not_found', 'Карточка блюда не найдена')
      const upload = await db.dishPhotoUpload.create({
        data: {
          dishId: input.dishId,
          createdByUserId: input.userId,
          objectKey: input.objectKey,
          contentType: input.contentType,
          byteSize: input.byteSize,
          expiresAt: input.expiresAt,
        },
        select: { id: true },
      })
      return upload.id
    },

    async findPhotoUpload(userId, dishId, uploadId) {
      const workspace = await workspaceContext(db, userId)
      const upload = await db.dishPhotoUpload.findFirst({
        where: { id: uploadId, dishId, dish: { branchId: workspace.branchId, isActive: true } },
        select: { id: true, objectKey: true, contentType: true, byteSize: true, expiresAt: true },
      })
      return upload as Awaited<ReturnType<DishesRepository['findPhotoUpload']>>
    },

    async discardPhotoUpload(userId, dishId, uploadId) {
      const workspace = await workspaceContext(db, userId)
      await db.dishPhotoUpload.deleteMany({
        where: { id: uploadId, dishId, dish: { branchId: workspace.branchId } },
      })
    },

    async publishPhoto(userId, dishId, uploadId) {
      const workspace = await workspaceContext(db, userId)
      const result = await db.$transaction(async (tx) => {
        const upload = await tx.dishPhotoUpload.findFirst({
          where: { id: uploadId, dishId, dish: { branchId: workspace.branchId, isActive: true } },
          select: { objectKey: true },
        })
        if (!upload) throw new DishesFailure('not_found', 'Загрузка фото блюда не найдена')
        const existing = await tx.dishCard.findUniqueOrThrow({
          where: { id: dishId },
          select: { photoObjectKey: true },
        })
        const dish = await tx.dishCard.update({
          where: { id: dishId },
          data: { photoObjectKey: upload.objectKey, photoPath: null },
          select: dishFields,
        })
        await tx.dishPhotoUpload.delete({ where: { id: uploadId } })
        return { dish, replacedObjectKey: existing.photoObjectKey }
      })
      return {
        dish: await dishDto(result.dish, canSeeCost(workspace.role), storage),
        replacedObjectKey: result.replacedObjectKey,
      }
    },
  }
}

async function assertProducts(
  db: Pick<DbClient, 'inventoryProduct'>,
  organizationId: string,
  input: SaveDishCardRequest,
) {
  const productIds = input.ingredients.map((ingredient) => ingredient.productId)
  const count = await db.inventoryProduct.count({
    where: { id: { in: productIds }, organizationId, isActive: true },
  })
  if (count !== productIds.length) {
    throw new DishesFailure('not_found', 'Один или несколько складских продуктов не найдены')
  }
}

const dishFields = {
  id: true,
  name: true,
  category: true,
  photoPath: true,
  photoObjectKey: true,
  sellingPrice: true,
  updatedAt: true,
  ingredients: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      productId: true,
      quantity: true,
      product: { select: { name: true, unit: true, unitCost: true } },
    },
  },
} as const

type DishRecord = {
  id: string
  name: string
  category: string | null
  photoPath: string | null
  photoObjectKey: string | null
  sellingPrice: Prisma.Decimal | null
  updatedAt: Date
  ingredients: Array<{
    id: string
    productId: string
    quantity: Prisma.Decimal
    product: { name: string; unit: DishCard['ingredients'][number]['unit']; unitCost: Prisma.Decimal }
  }>
}

async function dishDto(
  dish: DishRecord,
  costVisible: boolean,
  storage: PrivateStorage,
): Promise<DishCard> {
  const cost = dish.ingredients.reduce(
    (total, ingredient) => total.plus(ingredient.quantity.mul(ingredient.product.unitCost)),
    new Prisma.Decimal(0),
  )
  const sellingPrice = dish.sellingPrice ? new Prisma.Decimal(dish.sellingPrice) : null
  const photoUrl = dish.photoObjectKey
    ? (await storage.createDownloadUrl({ key: dish.photoObjectKey })).url
    : dish.photoPath
  return {
    id: dish.id,
    name: dish.name,
    category: dish.category,
    photoUrl,
    sellingPrice: costVisible && sellingPrice ? money(sellingPrice) : null,
    costPrice: costVisible ? money(cost) : null,
    marginAmount: costVisible && sellingPrice ? money(sellingPrice.minus(cost)) : null,
    ingredients: dish.ingredients.map((ingredient) => ({
      id: ingredient.id,
      productId: ingredient.productId,
      name: ingredient.product.name,
      unit: ingredient.product.unit,
      quantity: ingredient.quantity.toFixed(3),
      costAmount: costVisible ? money(ingredient.quantity.mul(ingredient.product.unitCost)) : null,
    })),
    updatedAt: dish.updatedAt.toISOString(),
  }
}

function money(value: Prisma.Decimal) {
  return value.toFixed(2)
}

function canSeeCost(role: WorkspaceRole) {
  return role === 'owner' || role === 'administrator'
}

async function workspaceContext(db: DbClient, userId: string) {
  const workspace = await resolveActiveWorkspace(db, userId)
  if (!workspace) throw new DishesFailure('not_found', 'Рабочее пространство кухни не найдено')
  return workspace
}

function throwDishConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new DishesFailure('conflict', 'Блюдо с таким названием уже существует')
  }
  throw error
}
