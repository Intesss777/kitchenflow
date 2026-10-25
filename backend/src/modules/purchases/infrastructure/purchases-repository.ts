import type {
  InventoryUnit,
  PurchaseDraftItem,
  PurchaseDraftProduct,
  PurchaseDraftResponse,
  SavePurchaseDraftRequest,
} from '@kitchenflow/contracts'

import { acquirePurchaseDraftMutationLock, type DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import { resolveActiveWorkspace } from '../../workspace'
import type { PurchaseDraftRepository } from '../application/ports'
import { PurchasesFailure } from '../domain/errors'

export function createPrismaPurchaseDraftRepository(db: DbClient): PurchaseDraftRepository {
  return {
    async readDraft(userId) {
      const workspace = await workspaceContext(db, userId)
      const [products, draft] = await db.$transaction([
        db.inventoryProduct.findMany({
          where: { organizationId: workspace.organizationId, isActive: true },
          orderBy: [{ name: 'asc' }],
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
            minimumQuantity: true,
            unitCost: true,
            balances: {
              where: { branchId: workspace.branchId },
              take: 1,
              select: { quantity: true },
            },
          },
        }),
        db.purchaseDraft.findUnique({
          where: { branchId: workspace.branchId },
          select: {
            note: true,
            updatedAt: true,
            items: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: {
                productId: true,
                requestedQuantity: true,
                product: {
                  select: { name: true, unit: true, unitCost: true },
                },
              },
            },
          },
        }),
      ])
      const costVisible = canSeeCost(workspace.role)
      const productRows: PurchaseDraftProduct[] = products.map((product) => {
        const quantity = product.balances[0]?.quantity ?? new Prisma.Decimal(0)
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          unit: product.unit,
          currentQuantity: quantity.toFixed(3),
          minimumQuantity: product.minimumQuantity.toFixed(3),
          unitCost: costVisible ? product.unitCost.toFixed(2) : null,
          isLowStock: quantity.lessThanOrEqualTo(product.minimumQuantity),
        }
      })
      const items: PurchaseDraftItem[] = (draft?.items ?? []).map((item) => ({
        productId: item.productId,
        name: item.product.name,
        unit: item.product.unit,
        requestedQuantity: item.requestedQuantity.toFixed(3),
        lineCost: costVisible
          ? item.requestedQuantity.mul(item.product.unitCost).toFixed(2)
          : null,
      }))
      return {
        workspace: {
          organizationName: workspace.organizationName,
          branchName: workspace.branchName,
          role: workspace.role,
        },
        note: draft?.note ?? null,
        items,
        products: productRows,
        metrics: {
          itemCount: items.length,
          lowStockCount: productRows.filter((product) => product.isLowStock).length,
          estimatedTotal: costVisible
            ? items.reduce((total, item) => total.plus(item.lineCost ?? '0'), new Prisma.Decimal(0)).toFixed(2)
            : null,
        },
        updatedAt: draft?.updatedAt.toISOString() ?? null,
      }
    },

    async saveDraft(userId, input) {
      const workspace = await workspaceContext(db, userId)
      const products = await
        db.inventoryProduct.findMany({
          where: {
            id: { in: input.items.map((item) => item.productId) },
            organizationId: workspace.organizationId,
            isActive: true,
          },
          select: { id: true },
        })
      if (products.length !== input.items.length) {
        throw new PurchasesFailure('not_found', 'Товар на складе не найден')
      }

      await db.$transaction(async (tx) => {
        await acquirePurchaseDraftMutationLock(tx, workspace.branchId)
        const draft = await tx.purchaseDraft.upsert({
          where: { branchId: workspace.branchId },
          create: {
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
            supplierId: null,
            updatedByUserId: userId,
            note: input.note,
          },
          update: {
            supplierId: null,
            updatedByUserId: userId,
            note: input.note,
          },
          select: { id: true },
        })
        await tx.purchaseDraftItem.deleteMany({ where: { draftId: draft.id } })
        if (input.items.length > 0) {
          await tx.purchaseDraftItem.createMany({
            data: input.items.map((item) => ({
              draftId: draft.id,
              productId: item.productId,
              requestedQuantity: item.requestedQuantity,
            })),
          })
        }
      })
    },
  }
}

async function workspaceContext(db: DbClient, userId: string) {
  const workspace = await resolveActiveWorkspace(db, userId)
  if (!workspace) {
    throw new PurchasesFailure('not_found', 'Рабочее пространство KitchenFlow не найдено')
  }
  return workspace
}

function canSeeCost(role: 'owner' | 'chef' | 'administrator') {
  return role === 'owner' || role === 'administrator'
}
