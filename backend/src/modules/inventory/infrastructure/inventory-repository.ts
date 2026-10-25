import type {
  CreateInventoryMovementResponse,
  InventoryMovement,
  InventoryOverviewResponse,
  InventoryProduct,
  InventoryProductDetailResponse,
} from '@kitchenflow/contracts'

import { acquireInventoryBalanceMutationLock, type DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import { resolveActiveWorkspace } from '../../workspace'
import type { InventoryRepository } from '../application/ports'
import { InventoryFailure } from '../domain/errors'

export function createPrismaInventoryRepository(db: DbClient): InventoryRepository {
  return {
    async readOverview(userId, now) {
      const workspace = await workspaceContext(db, userId)
      const startOfDay = new Date(now)
      startOfDay.setUTCHours(0, 0, 0, 0)
      const [products, receiptsToday] = await db.$transaction([
        db.inventoryProduct.findMany({
          where: { organizationId: workspace.organizationId, isActive: true },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
          select: {
            ...productFields,
            balances: {
              where: { branchId: workspace.branchId },
              take: 1,
              select: balanceFields,
            },
          },
        }),
        db.inventoryMovement.count({
          where: {
            branchId: workspace.branchId,
            type: 'receipt',
            occurredAt: { gte: startOfDay },
          },
        }),
      ])
      const costVisible = canSeeCost(workspace.role)
      const rows = products.map((product) =>
        productDto(product, product.balances[0] ?? null, costVisible),
      )
      const stockValue = products.reduce((total, product) => {
        const quantity = product.balances[0]?.quantity ?? new Prisma.Decimal(0)
        return total.plus(quantity.mul(product.unitCost))
      }, new Prisma.Decimal(0))

      return {
        workspace: {
          organizationName: workspace.organizationName,
          branchName: workspace.branchName,
          role: workspace.role,
        },
        metrics: {
          activeProducts: rows.length,
          lowStockProducts: rows.filter((product) => product.isLowStock).length,
          receiptsToday,
          stockValue: costVisible ? money(stockValue) : null,
        },
        products: rows,
      } satisfies InventoryOverviewResponse
    },

    async createProduct(userId, input, now) {
      const workspace = await workspaceContext(db, userId)
      requireProductManagement(workspace.role)
      const costVisible = canSeeCost(workspace.role)
      try {
        const product = await db.inventoryProduct.create({
          data: {
            organizationId: workspace.organizationId,
            name: input.name,
            category: input.category,
            unit: input.unit,
            minimumQuantity: input.minimumQuantity,
            unitCost: costVisible && input.unitCost ? input.unitCost : '0.00',
            balances: {
              create: { branchId: workspace.branchId, quantity: '0.000' },
            },
          },
          select: {
            ...productFields,
            balances: { take: 1, select: balanceFields },
          },
        })
        return productDto(product, product.balances[0] ?? null, costVisible, now)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new InventoryFailure('conflict', 'Товар с таким названием уже существует')
        }
        throw error
      }
    },

    async updateProduct(userId, productId, input, now) {
      const workspace = await workspaceContext(db, userId)
      requireProductManagement(workspace.role)
      const costVisible = canSeeCost(workspace.role)
      try {
        const product = await db.inventoryProduct.update({
          where: {
            id: productId,
            organizationId: workspace.organizationId,
            isActive: true,
          },
          data: {
            name: input.name,
            category: input.category,
            minimumQuantity: input.minimumQuantity,
            ...(input.unitCost === null ? {} : { unitCost: input.unitCost }),
          },
          select: {
            ...productFields,
            balances: {
              where: { branchId: workspace.branchId },
              take: 1,
              select: balanceFields,
            },
          },
        })
        return productDto(product, product.balances[0] ?? null, costVisible, now)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new InventoryFailure('conflict', 'Товар с таким названием уже существует')
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new InventoryFailure('not_found', 'Товар на складе не найден')
        }
        throw error
      }
    },

    async archiveProduct(userId, productId) {
      const workspace = await workspaceContext(db, userId)
      requireProductManagement(workspace.role)
      await db.$transaction(async (tx) => {
        const product = await tx.inventoryProduct.findFirst({
          where: {
            id: productId,
            organizationId: workspace.organizationId,
            isActive: true,
          },
          select: { id: true },
        })
        if (!product) throw new InventoryFailure('not_found', 'Товар на складе не найден')

        const [nonEmptyBalances, activeDishIngredients] = await Promise.all([
          tx.inventoryBalance.count({
            where: { productId, quantity: { not: '0.000' } },
          }),
          tx.dishIngredient.count({
            where: { productId, dish: { isActive: true } },
          }),
        ])
        if (nonEmptyBalances > 0) {
          throw new InventoryFailure(
            'conflict',
            'Перед удалением обнулите остаток товара во всех филиалах',
          )
        }
        if (activeDishIngredients > 0) {
          throw new InventoryFailure(
            'conflict',
            'Перед удалением уберите товар из действующих карт блюд',
          )
        }

        await tx.purchaseDraftItem.deleteMany({ where: { productId } })
        await tx.inventoryProduct.update({
          where: { id: productId },
          data: { isActive: false },
        })
      })
    },

    async createMovement(userId, productId, input, now) {
      const workspace = await workspaceContext(db, userId)
      const costVisible = canSeeCost(workspace.role)
      const result = await db.$transaction(async (tx) => {
        await acquireInventoryBalanceMutationLock(tx, workspace.branchId, productId)
        const product = await tx.inventoryProduct.findFirst({
          where: {
            id: productId,
            organizationId: workspace.organizationId,
            isActive: true,
          },
          select: productFields,
        })
        if (!product) throw new InventoryFailure('not_found', 'Товар на складе не найден')

        const balance = await tx.inventoryBalance.findUnique({
          where: {
            branchId_productId: { branchId: workspace.branchId, productId },
          },
          select: balanceFields,
        })
        const currentQuantity = balance?.quantity ?? new Prisma.Decimal(0)
        const inputQuantity = new Prisma.Decimal(input.quantity)
        const quantityDelta = input.type === 'receipt'
          ? inputQuantity
          : input.type === 'writeoff'
            ? inputQuantity.negated()
            : inputQuantity.minus(currentQuantity)
        const resultingQuantity = currentQuantity.plus(quantityDelta)
        if (resultingQuantity.isNegative()) {
          throw new InventoryFailure('conflict', 'Количество списания превышает текущий остаток')
        }

        const suppliedUnitCost = costVisible && input.type === 'receipt' && input.unitCost
          ? new Prisma.Decimal(input.unitCost)
          : null
        const nextProduct = suppliedUnitCost
          ? await tx.inventoryProduct.update({
              where: { id: productId },
              data: { unitCost: suppliedUnitCost },
              select: productFields,
            })
          : product
        const nextBalance = await tx.inventoryBalance.upsert({
          where: {
            branchId_productId: { branchId: workspace.branchId, productId },
          },
          create: {
            branchId: workspace.branchId,
            productId,
            quantity: resultingQuantity,
          },
          update: { quantity: resultingQuantity },
          select: balanceFields,
        })
        const movement = await tx.inventoryMovement.create({
          data: {
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
            productId,
            createdByUserId: userId,
            type: input.type,
            quantityDelta,
            resultingQuantity,
            unitCost: suppliedUnitCost,
            occurredAt: new Date(input.occurredAt),
            reference: input.reference,
            note: input.note,
          },
          select: movementFields,
        })
        return { movement, nextBalance, nextProduct }
      })

      return {
        movement: movementDto(result.movement, costVisible),
        product: productDto(result.nextProduct, result.nextBalance, costVisible, now),
      } satisfies CreateInventoryMovementResponse
    },

    async readProduct(userId, productId) {
      const workspace = await workspaceContext(db, userId)
      const costVisible = canSeeCost(workspace.role)
      const product = await db.inventoryProduct.findFirst({
        where: {
          id: productId,
          organizationId: workspace.organizationId,
          isActive: true,
        },
        select: {
          ...productFields,
          balances: {
            where: { branchId: workspace.branchId },
            take: 1,
            select: balanceFields,
          },
          movements: {
            where: { branchId: workspace.branchId },
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            take: 80,
            select: movementFields,
          },
        },
      })
      if (!product) throw new InventoryFailure('not_found', 'Товар на складе не найден')
      return {
        product: productDto(product, product.balances[0] ?? null, costVisible),
        movements: product.movements.map((movement) => movementDto(movement, costVisible)),
      } satisfies InventoryProductDetailResponse
    },
  }
}

const productFields = {
  id: true,
  name: true,
  category: true,
  unit: true,
  minimumQuantity: true,
  unitCost: true,
  updatedAt: true,
} as const

const balanceFields = {
  quantity: true,
  updatedAt: true,
} as const

const movementFields = {
  id: true,
  type: true,
  quantityDelta: true,
  resultingQuantity: true,
  unitCost: true,
  occurredAt: true,
  reference: true,
  note: true,
  createdBy: { select: { displayName: true, email: true } },
} as const

type ProductRecord = {
  id: string
  name: string
  category: string | null
  unit: InventoryProduct['unit']
  minimumQuantity: Prisma.Decimal
  unitCost: Prisma.Decimal
  updatedAt: Date
}

type BalanceRecord = { quantity: Prisma.Decimal; updatedAt: Date }

function productDto(
  product: ProductRecord,
  balance: BalanceRecord | null,
  costVisible: boolean,
  fallbackUpdatedAt?: Date,
): InventoryProduct {
  const quantity = balance?.quantity ?? new Prisma.Decimal(0)
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    unit: product.unit,
    quantity: decimalQuantity(quantity),
    minimumQuantity: decimalQuantity(product.minimumQuantity),
    unitCost: costVisible ? money(product.unitCost) : null,
    isLowStock: quantity.lessThanOrEqualTo(product.minimumQuantity),
    updatedAt: (balance?.updatedAt ?? product.updatedAt ?? fallbackUpdatedAt ?? new Date()).toISOString(),
  }
}

function movementDto(
  movement: {
    id: string
    type: InventoryMovement['type']
    quantityDelta: Prisma.Decimal
    resultingQuantity: Prisma.Decimal
    unitCost: Prisma.Decimal | null
    occurredAt: Date
    reference: string | null
    note: string | null
    createdBy: { displayName: string | null; email: string } | null
  },
  costVisible: boolean,
): InventoryMovement {
  return {
    id: movement.id,
    type: movement.type,
    quantityDelta: decimalQuantity(movement.quantityDelta),
    resultingQuantity: decimalQuantity(movement.resultingQuantity),
    unitCost: costVisible && movement.unitCost ? money(movement.unitCost) : null,
    occurredAt: movement.occurredAt.toISOString(),
    reference: movement.reference,
    note: movement.note,
    createdByName: movement.createdBy?.displayName ?? movement.createdBy?.email ?? 'Сотрудник',
  }
}

async function workspaceContext(db: DbClient, userId: string) {
  const workspace = await resolveActiveWorkspace(db, userId)
  if (!workspace) {
    throw new InventoryFailure('not_found', 'Рабочее пространство KitchenFlow не найдено')
  }
  return workspace
}

function canSeeCost(role: 'owner' | 'chef' | 'administrator') {
  return role === 'owner' || role === 'administrator'
}

function requireProductManagement(role: 'owner' | 'chef' | 'administrator') {
  if (role === 'chef') {
    throw new InventoryFailure('forbidden', 'Управлять товарами может только владелец или администратор')
  }
}

function decimalQuantity(value: Prisma.Decimal) {
  return value.toFixed(3)
}

function money(value: Prisma.Decimal) {
  return value.toFixed(2)
}
