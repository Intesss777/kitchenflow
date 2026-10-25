import type {
  InventoryUnit,
  SalesShift,
  SalesShiftsOverviewResponse,
} from '@kitchenflow/contracts'

import {
  acquireInventoryBalanceMutationLock,
  acquireSalesShiftMutationLock,
  type DbClient,
} from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import { resolveActiveWorkspace } from '../../workspace'
import type { SalesReceiptUploadRecord, ShiftsRepository } from '../application/ports'
import { ShiftsFailure } from '../domain/errors'

export function createPrismaShiftsRepository(db: DbClient): ShiftsRepository {
  return {
    async createPending(input) {
      const workspace = await workspaceContext(db, input.userId)
      return db.$transaction(async (tx) => {
        const shiftDate = new Date(`${input.shiftDate}T00:00:00.000Z`)
        const shift = await tx.salesShift.upsert({
          where: { branchId_shiftDate: { branchId: workspace.branchId, shiftDate } },
          create: {
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
            createdByUserId: input.userId,
            shiftDate,
          },
          update: {},
          select: { id: true, status: true },
        })
        if (shift.status === 'confirmed') {
          throw new ShiftsFailure('conflict', 'Эта смена уже закрыта')
        }
        const receipt = await tx.salesReceipt.create({
          data: {
            shiftId: shift.id,
            createdByUserId: input.userId,
            objectKey: input.objectKey,
            contentType: input.contentType,
            byteSize: input.byteSize,
            uploadExpiresAt: input.uploadExpiresAt,
          },
          select: { id: true },
        })
        return { shiftId: shift.id, receiptId: receipt.id }
      })
    },

    async findUpload(userId, receiptId) {
      const workspace = await workspaceContext(db, userId)
      const receipt = await db.salesReceipt.findFirst({
        where: {
          id: receiptId,
          shift: { organizationId: workspace.organizationId, branchId: workspace.branchId },
        },
        select: {
          id: true,
          shiftId: true,
          objectKey: true,
          contentType: true,
          byteSize: true,
          uploadExpiresAt: true,
          status: true,
        },
      })
      return receipt ? {
        ...receipt,
        contentType: receipt.contentType as SalesReceiptUploadRecord['contentType'],
      } : null
    },

    async markRejected(userId, receiptId) {
      const workspace = await workspaceContext(db, userId)
      await db.salesReceipt.updateMany({
        where: {
          id: receiptId,
          shift: { organizationId: workspace.organizationId, branchId: workspace.branchId },
          status: 'upload_pending',
        },
        data: { status: 'rejected' },
      })
    },

    async recognize(userId, receiptId, now) {
      const workspace = await workspaceContext(db, userId)
      return db.$transaction(async (tx) => {
        const initial = await tx.salesReceipt.findFirst({
          where: {
            id: receiptId,
            shift: { organizationId: workspace.organizationId, branchId: workspace.branchId },
          },
          select: { shiftId: true },
        })
        if (!initial) throw new ShiftsFailure('not_found', 'Чек не найден')
        await acquireSalesShiftMutationLock(tx, initial.shiftId)
        const receipt = await tx.salesReceipt.findFirst({
          where: {
            id: receiptId,
            shift: { organizationId: workspace.organizationId, branchId: workspace.branchId },
          },
          select: { id: true, shiftId: true, status: true, shift: { select: { status: true } } },
        })
        if (!receipt) throw new ShiftsFailure('not_found', 'Чек не найден')
        if (receipt.status !== 'upload_pending') return receipt.shiftId
        if (receipt.shift.status !== 'review') {
          throw new ShiftsFailure('conflict', 'В закрытую смену нельзя добавить чек')
        }
        const dishes = await tx.dishCard.findMany({
          where: {
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
            isActive: true,
            ingredients: { some: {} },
          },
          orderBy: { name: 'asc' },
          take: 3,
          select: { id: true },
        })
        if (dishes.length === 0) {
          throw new ShiftsFailure('conflict', 'Добавьте хотя бы одну карточку блюда перед распознаванием чеков')
        }
        const existing = await tx.salesShiftLine.findMany({
          where: { shiftId: receipt.shiftId },
          select: { dishId: true, position: true },
        })
        const byDish = new Map(existing.map((line) => [line.dishId, line]))
        let nextPosition = existing.reduce((highest, line) => Math.max(highest, line.position + 1), 0)
        const quantities = [2, 1, 3]
        for (const [index, dish] of dishes.entries()) {
          const line = byDish.get(dish.id)
          if (line) {
            await tx.salesShiftLine.update({
              where: { shiftId_dishId: { shiftId: receipt.shiftId, dishId: dish.id } },
              data: { quantity: { increment: quantities[index] ?? 1 } },
            })
          } else {
            await tx.salesShiftLine.create({
              data: {
                shiftId: receipt.shiftId,
                dishId: dish.id,
                position: nextPosition++,
                quantity: quantities[index] ?? 1,
              },
            })
          }
        }
        await tx.salesReceipt.update({
          where: { id: receipt.id },
          data: {
            status: 'recognized',
            recognitionConfidence: '0.8200',
            recognizedAt: now,
          },
        })
        return receipt.shiftId
      })
    },

    async list(userId, now) {
      const workspace = await workspaceContext(db, userId)
      const currentBusinessDate = dateInTimeZone(now, workspace.timezone)
      const today = new Date(`${currentBusinessDate}T00:00:00.000Z`)
      const monthStart = new Date(`${currentBusinessDate.slice(0, 7)}-01T00:00:00.000Z`)
      const [shifts, dishes] = await db.$transaction([
        db.salesShift.findMany({
          where: { organizationId: workspace.organizationId, branchId: workspace.branchId },
          orderBy: [{ shiftDate: 'desc' }, { createdAt: 'desc' }],
          take: 40,
          select: shiftSummarySelect,
        }),
        db.dishCard.findMany({
          where: {
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
            isActive: true,
          },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
      ])
      const todayShift = shifts.find((shift) => shift.shiftDate.getTime() === today.getTime())
      return {
        workspace: {
          organizationName: workspace.organizationName,
          branchName: workspace.branchName,
          role: workspace.role,
          businessDate: currentBusinessDate,
        },
        metrics: {
          receiptsToday: todayShift?._count.receipts ?? 0,
          dishesToday: todayShift?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0,
          needsReview: shifts.filter((shift) => shift.status === 'review').length,
          confirmedThisMonth: shifts.filter(
            (shift) => shift.status === 'confirmed' && shift.shiftDate >= monthStart,
          ).length,
        },
        dishes,
        shifts: shifts.map(shiftSummaryDto),
      } satisfies SalesShiftsOverviewResponse
    },

    async read(userId, shiftId) {
      const workspace = await workspaceContext(db, userId)
      return readShift(db, workspace, shiftId)
    },

    async receiptObjects(userId, shiftId) {
      const workspace = await workspaceContext(db, userId)
      return db.salesReceipt.findMany({
        where: {
          shiftId,
          shift: { organizationId: workspace.organizationId, branchId: workspace.branchId },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, objectKey: true },
      })
    },

    async update(userId, shiftId, input) {
      const workspace = await workspaceContext(db, userId)
      await db.$transaction(async (tx) => {
        await acquireSalesShiftMutationLock(tx, shiftId)
        const shift = await tx.salesShift.findFirst({
          where: {
            id: shiftId,
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
          },
          select: { status: true },
        })
        if (!shift) throw new ShiftsFailure('not_found', 'Смена не найдена')
        if (shift.status !== 'review') {
          throw new ShiftsFailure('conflict', 'Редактировать можно только смену, ожидающую проверки')
        }
        const dishIds = input.lines.map((line) => line.dishId)
        const dishes = await tx.dishCard.findMany({
          where: {
            id: { in: dishIds },
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
            isActive: true,
            ingredients: { some: {} },
          },
          select: { id: true },
        })
        if (dishes.length !== dishIds.length) {
          throw new ShiftsFailure('not_found', 'Одна из карточек блюд не найдена')
        }
        await tx.salesShiftLine.deleteMany({ where: { shiftId } })
        await tx.salesShiftLine.createMany({
          data: input.lines.map((line, position) => ({ shiftId, position, ...line })),
        })
      })
      return readShift(db, workspace, shiftId)
    },

    async confirm(userId, shiftId, now) {
      const workspace = await workspaceContext(db, userId)
      await db.$transaction(async (tx) => {
        await acquireSalesShiftMutationLock(tx, shiftId)
        const shift = await tx.salesShift.findFirst({
          where: {
            id: shiftId,
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
          },
          select: {
            id: true,
            shiftDate: true,
            status: true,
            receipts: { where: { status: 'recognized' }, select: { id: true } },
            lines: {
              select: {
                quantity: true,
                dish: {
                  select: {
                    ingredients: {
                      select: {
                        quantity: true,
                        product: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        })
        if (!shift) throw new ShiftsFailure('not_found', 'Смена не найдена')
        if (shift.status === 'confirmed') return
        if (shift.receipts.length === 0 || shift.lines.length === 0) {
          throw new ShiftsFailure('conflict', 'Сначала распознайте чек и проверьте проданные блюда')
        }
        const usage = new Map<string, { name: string; quantity: Prisma.Decimal }>()
        for (const line of shift.lines) {
          for (const ingredient of line.dish.ingredients) {
            const quantity = ingredient.quantity.mul(line.quantity)
            const current = usage.get(ingredient.product.id)
            usage.set(ingredient.product.id, {
              name: ingredient.product.name,
              quantity: current ? current.quantity.plus(quantity) : quantity,
            })
          }
        }
        if (usage.size === 0) throw new ShiftsFailure('conflict', 'У проданных блюд не указаны ингредиенты')

        for (const [productId, item] of [...usage.entries()].sort(([left], [right]) => left.localeCompare(right))) {
          await acquireInventoryBalanceMutationLock(tx, workspace.branchId, productId)
          const balance = await tx.inventoryBalance.findUnique({
            where: { branchId_productId: { branchId: workspace.branchId, productId } },
            select: { quantity: true },
          })
          const quantityBefore = balance?.quantity ?? new Prisma.Decimal(0)
          const quantityAfter = quantityBefore.minus(item.quantity)
          if (quantityAfter.isNegative()) {
            throw new ShiftsFailure('conflict', `Недостаточно продукта «${item.name}» на складе для закрытия смены`)
          }
          await tx.inventoryBalance.upsert({
            where: { branchId_productId: { branchId: workspace.branchId, productId } },
            create: { branchId: workspace.branchId, productId, quantity: quantityAfter },
            update: { quantity: quantityAfter },
          })
          await tx.salesShiftConsumption.create({
            data: {
              shiftId,
              productId,
              quantityBefore,
              quantityUsed: item.quantity,
              quantityAfter,
            },
          })
          await tx.inventoryMovement.create({
            data: {
              organizationId: workspace.organizationId,
              branchId: workspace.branchId,
              productId,
              createdByUserId: userId,
              salesShiftId: shiftId,
              type: 'writeoff',
              quantityDelta: item.quantity.negated(),
              resultingQuantity: quantityAfter,
              occurredAt: shift.shiftDate,
              reference: `Смена ${dateOnly(shift.shiftDate)}`,
              note: 'Теоретический расход по подтверждённым чекам',
            },
          })
        }
        await tx.salesShift.update({
          where: { id: shiftId },
          data: { status: 'confirmed', confirmedByUserId: userId, confirmedAt: now },
        })
      })
      return readShift(db, workspace, shiftId)
    },
  }
}

const shiftSummarySelect = {
  id: true,
  shiftDate: true,
  status: true,
  recognitionMode: true,
  createdAt: true,
  confirmedAt: true,
  createdBy: { select: { displayName: true, email: true } },
  confirmedBy: { select: { displayName: true, email: true } },
  _count: { select: { receipts: true } },
  lines: { select: { quantity: true } },
} as const

type Workspace = Awaited<ReturnType<typeof workspaceContext>>

async function readShift(db: DbClient, workspace: Workspace, shiftId: string): Promise<SalesShift> {
  const shift = await db.salesShift.findFirst({
    where: {
      id: shiftId,
      organizationId: workspace.organizationId,
      branchId: workspace.branchId,
    },
    select: {
      id: true,
      shiftDate: true,
      status: true,
      recognitionMode: true,
      createdAt: true,
      confirmedAt: true,
      createdBy: { select: { displayName: true, email: true } },
      confirmedBy: { select: { displayName: true, email: true } },
      receipts: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          status: true,
          recognitionConfidence: true,
          createdAt: true,
        },
      },
      lines: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          dishId: true,
          quantity: true,
          dish: {
            select: {
              name: true,
              ingredients: {
                select: {
                  quantity: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      unit: true,
                      balances: {
                        where: { branchId: workspace.branchId },
                        take: 1,
                        select: { quantity: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      consumption: {
        orderBy: { product: { name: 'asc' } },
        select: {
          productId: true,
          quantityBefore: true,
          quantityUsed: true,
          quantityAfter: true,
          product: { select: { name: true, unit: true } },
        },
      },
    },
  })
  if (!shift) throw new ShiftsFailure('not_found', 'Смена не найдена')

  const liveConsumption = new Map<string, {
    productId: string
    productName: string
    unit: InventoryUnit
    quantityBefore: Prisma.Decimal
    quantityUsed: Prisma.Decimal
  }>()
  if (shift.status === 'review') {
    for (const line of shift.lines) {
      for (const ingredient of line.dish.ingredients) {
        const product = ingredient.product
        const used = ingredient.quantity.mul(line.quantity)
        const current = liveConsumption.get(product.id)
        liveConsumption.set(product.id, {
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantityBefore: product.balances[0]?.quantity ?? new Prisma.Decimal(0),
          quantityUsed: current ? current.quantityUsed.plus(used) : used,
        })
      }
    }
  }

  return {
    id: shift.id,
    shiftDate: dateOnly(shift.shiftDate),
    status: shift.status,
    recognitionMode: shift.recognitionMode,
    createdByName: personName(shift.createdBy),
    confirmedByName: shift.confirmedBy ? personName(shift.confirmedBy) : null,
    createdAt: shift.createdAt.toISOString(),
    confirmedAt: shift.confirmedAt?.toISOString() ?? null,
    receipts: shift.receipts.map((receipt) => ({
      id: receipt.id,
      status: receipt.status,
      recognitionConfidence: receipt.recognitionConfidence
        ? Number(receipt.recognitionConfidence)
        : null,
      imageUrl: null,
      createdAt: receipt.createdAt.toISOString(),
    })),
    lines: shift.lines.map((line) => ({
      id: line.id,
      dishId: line.dishId,
      dishName: line.dish.name,
      quantity: line.quantity,
    })),
    consumption: shift.status === 'confirmed'
      ? shift.consumption.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          unit: item.product.unit,
          quantityBefore: decimal(item.quantityBefore),
          quantityUsed: decimal(item.quantityUsed),
          quantityAfter: decimal(item.quantityAfter),
        }))
      : [...liveConsumption.values()]
          .sort((left, right) => left.productName.localeCompare(right.productName, 'ru'))
          .map((item) => ({
            productId: item.productId,
            productName: item.productName,
            unit: item.unit,
            quantityBefore: decimal(item.quantityBefore),
            quantityUsed: decimal(item.quantityUsed),
            quantityAfter: decimal(item.quantityBefore.minus(item.quantityUsed)),
          })),
  }
}

function shiftSummaryDto(shift: {
  id: string
  shiftDate: Date
  status: 'review' | 'confirmed'
  recognitionMode: 'demo' | 'provider'
  createdAt: Date
  confirmedAt: Date | null
  createdBy: { displayName: string | null; email: string } | null
  confirmedBy: { displayName: string | null; email: string } | null
  _count: { receipts: number }
  lines: Array<{ quantity: number }>
}) {
  return {
    id: shift.id,
    shiftDate: dateOnly(shift.shiftDate),
    status: shift.status,
    recognitionMode: shift.recognitionMode,
    createdByName: personName(shift.createdBy),
    confirmedByName: shift.confirmedBy ? personName(shift.confirmedBy) : null,
    createdAt: shift.createdAt.toISOString(),
    confirmedAt: shift.confirmedAt?.toISOString() ?? null,
    receiptCount: shift._count.receipts,
    dishCount: shift.lines.reduce((total, line) => total + line.quantity, 0),
  }
}

async function workspaceContext(db: DbClient, userId: string) {
  const workspace = await resolveActiveWorkspace(db, userId)
  if (!workspace) throw new ShiftsFailure('not_found', 'Рабочее пространство KitchenFlow не найдено')
  return workspace
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function dateInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`
}

function decimal(value: Prisma.Decimal) {
  return value.toFixed(3)
}

function personName(person: { displayName: string | null; email: string } | null) {
  return person?.displayName ?? person?.email ?? 'Сотрудник'
}
