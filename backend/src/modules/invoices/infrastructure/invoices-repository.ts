import type {
  InventoryUnit,
  PurchaseInvoice,
  PurchaseInvoiceListResponse,
  UpdatePurchaseInvoiceRequest,
} from '@kitchenflow/contracts'

import {
  acquireInventoryBalanceMutationLock,
  acquirePurchaseInvoiceMutationLock,
  type DbClient,
} from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import { resolveActiveWorkspace } from '../../workspace'
import type {
  InvoiceUploadRecord,
  InvoicesRepository,
} from '../application/ports'
import { InvoicesFailure } from '../domain/errors'

export function createPrismaInvoicesRepository(db: DbClient): InvoicesRepository {
  return {
    async createPending(input) {
      const workspace = await workspaceContext(db, input.userId)
      const invoice = await db.purchaseInvoice.create({
        data: {
          organizationId: workspace.organizationId,
          branchId: workspace.branchId,
          createdByUserId: input.userId,
          objectKey: input.objectKey,
          contentType: input.contentType,
          byteSize: input.byteSize,
          uploadExpiresAt: input.uploadExpiresAt,
        },
        select: { id: true },
      })
      return invoice.id
    },

    async findUpload(userId, invoiceId) {
      const workspace = await workspaceContext(db, userId)
      const row = await db.purchaseInvoice.findFirst({
        where: {
          id: invoiceId,
          organizationId: workspace.organizationId,
          branchId: workspace.branchId,
        },
        select: {
          id: true,
          objectKey: true,
          contentType: true,
          byteSize: true,
          uploadExpiresAt: true,
          status: true,
        },
      })
      return row ? uploadRecord(row) : null
    },

    async markRejected(userId, invoiceId) {
      const workspace = await workspaceContext(db, userId)
      await db.purchaseInvoice.updateMany({
        where: {
          id: invoiceId,
          organizationId: workspace.organizationId,
          branchId: workspace.branchId,
          status: 'upload_pending',
        },
        data: { status: 'rejected' },
      })
    },

    async recognize(userId, invoiceId, now) {
      const workspace = await workspaceContext(db, userId)
      await db.$transaction(async (tx) => {
        await acquirePurchaseInvoiceMutationLock(tx, invoiceId)
        const invoice = await tx.purchaseInvoice.findFirst({
          where: {
            id: invoiceId,
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
          },
          select: { id: true, status: true },
        })
        if (!invoice) throw new InvoicesFailure('not_found', 'Invoice not found')
        if (invoice.status !== 'upload_pending') return

        const [suppliers, products] = await Promise.all([
          tx.supplier.findMany({
            where: { organizationId: workspace.organizationId, isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, paymentTermsDays: true },
          }),
          tx.inventoryProduct.findMany({
            where: { organizationId: workspace.organizationId, isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, unit: true, unitCost: true },
          }),
        ])
        const supplier = suppliers.find((item) => item.name === 'METRO') ?? suppliers[0]
        const selectedProducts = preferredProducts(products)
        if (!supplier || selectedProducts.length === 0) {
          throw new InvoicesFailure(
            'conflict',
            'Add at least one supplier and inventory product before recognizing an invoice',
          )
        }
        const quantities = ['3.500', '6.000', '4.000']
        const items = selectedProducts.map((product, index) => {
          const quantity = new Prisma.Decimal(quantities[index] ?? '1.000')
          return {
            invoiceId,
            productId: product.id,
            position: index,
            detectedName: product.name,
            unit: product.unit,
            quantity,
            unitPrice: product.unitCost,
            lineTotal: quantity.mul(product.unitCost).toDecimalPlaces(2),
          }
        })
        const totalAmount = items.reduce(
          (total, item) => total.plus(item.lineTotal),
          new Prisma.Decimal(0),
        )
        const invoiceDate = startOfUtcDay(now)
        const dueAt = new Date(invoiceDate.getTime() + supplier.paymentTermsDays * dayMs)
        await tx.purchaseInvoiceItem.createMany({ data: items })
        await tx.purchaseInvoice.update({
          where: { id: invoiceId },
          data: {
            status: 'review',
            recognitionMode: 'demo',
            recognitionConfidence: '0.8600',
            supplierId: supplier.id,
            invoiceNumber: `OCR-${invoiceId.slice(-6).toUpperCase()}`,
            invoiceDate,
            dueAt,
            totalAmount,
            recognizedAt: now,
          },
        })
      })
      return readInvoice(db, workspace.organizationId, workspace.branchId, invoiceId)
    },

    async list(userId, query, now) {
      const workspace = await workspaceContext(db, userId)
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      const rangeStart = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null
      const rangeEndExclusive = query.to
        ? new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + dayMs)
        : null
      const archiveWhere: Prisma.PurchaseInvoiceWhereInput = {
        organizationId: workspace.organizationId,
        branchId: workspace.branchId,
        status: query.status ?? { not: 'upload_pending' },
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(rangeStart && rangeEndExclusive
          ? { invoiceDate: { gte: rangeStart, lt: rangeEndExclusive } }
          : {}),
        ...(query.q
          ? {
              OR: [
                { invoiceNumber: { contains: query.q, mode: 'insensitive' } },
                { supplier: { name: { contains: query.q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      }
      const monthlyWhere: Prisma.PurchaseInvoiceWhereInput = {
        organizationId: workspace.organizationId,
        branchId: workspace.branchId,
        status: 'confirmed',
        confirmedAt: { gte: monthStart, lt: nextMonthStart },
      }
      const [invoices, total, suppliers, products, needsReview, confirmedThisMonth] = await db.$transaction([
        db.purchaseInvoice.findMany({
          where: archiveWhere,
          orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: invoiceSummarySelect,
        }),
        db.purchaseInvoice.count({ where: archiveWhere }),
        db.supplier.findMany({
          where: { organizationId: workspace.organizationId, isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
        db.inventoryProduct.findMany({
          where: { organizationId: workspace.organizationId, isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, unit: true },
        }),
        db.purchaseInvoice.count({
          where: {
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
            status: 'review',
          },
        }),
        db.purchaseInvoice.aggregate({
          where: monthlyWhere,
          _count: true,
          _sum: { totalAmount: true },
        }),
      ])
      return {
        workspace: {
          organizationName: workspace.organizationName,
          branchName: workspace.branchName,
          role: workspace.role,
        },
        metrics: {
          needsReview,
          confirmedThisMonth: confirmedThisMonth._count,
          amountThisMonth: money(confirmedThisMonth._sum.totalAmount ?? new Prisma.Decimal(0)),
        },
        suppliers,
        products,
        invoices: invoices.map(summaryDto),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          hasNext: query.page * query.pageSize < total,
        },
      } satisfies PurchaseInvoiceListResponse
    },

    async read(userId, invoiceId) {
      const workspace = await workspaceContext(db, userId)
      return readInvoice(db, workspace.organizationId, workspace.branchId, invoiceId)
    },

    async update(userId, invoiceId, input) {
      const workspace = await workspaceContext(db, userId)
      await db.$transaction(async (tx) => {
        await acquirePurchaseInvoiceMutationLock(tx, invoiceId)
        const invoice = await tx.purchaseInvoice.findFirst({
          where: {
            id: invoiceId,
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
          },
          select: { status: true },
        })
        if (!invoice) throw new InvoicesFailure('not_found', 'Invoice not found')
        if (invoice.status !== 'review') {
          throw new InvoicesFailure('conflict', 'Only an invoice awaiting review can be edited')
        }
        const supplier = await tx.supplier.findFirst({
          where: {
            id: input.supplierId,
            organizationId: workspace.organizationId,
            isActive: true,
          },
          select: { id: true },
        })
        if (!supplier) throw new InvoicesFailure('not_found', 'Supplier not found')
        const productIds = input.items.flatMap((item) => item.productId ? [item.productId] : [])
        const products = await tx.inventoryProduct.findMany({
          where: {
            id: { in: productIds },
            organizationId: workspace.organizationId,
            isActive: true,
          },
          select: { id: true, unit: true },
        })
        const productsById = new Map(products.map((product) => [product.id, product]))
        if (products.length !== new Set(productIds).size) {
          throw new InvoicesFailure('not_found', 'One of the inventory products was not found')
        }
        for (const item of input.items) {
          const product = item.productId ? productsById.get(item.productId) : null
          if (product && product.unit !== item.unit) {
            throw new InvoicesFailure('conflict', 'Invoice unit must match the inventory product unit')
          }
        }
        const rows = reviewedItemRows(invoiceId, input)
        const totalAmount = rows.reduce(
          (total, item) => total.plus(item.lineTotal),
          new Prisma.Decimal(0),
        )
        await tx.purchaseInvoiceItem.deleteMany({ where: { invoiceId } })
        await tx.purchaseInvoiceItem.createMany({ data: rows })
        await tx.purchaseInvoice.update({
          where: { id: invoiceId },
          data: {
            supplierId: input.supplierId,
            invoiceNumber: input.invoiceNumber,
            invoiceDate: new Date(`${input.invoiceDate}T00:00:00.000Z`),
            dueAt: new Date(`${input.dueAt}T00:00:00.000Z`),
            totalAmount,
          },
        })
      })
      return readInvoice(db, workspace.organizationId, workspace.branchId, invoiceId)
    },

    async confirm(userId, invoiceId, now) {
      const workspace = await workspaceContext(db, userId)
      await db.$transaction(async (tx) => {
        await acquirePurchaseInvoiceMutationLock(tx, invoiceId)
        const invoice = await tx.purchaseInvoice.findFirst({
          where: {
            id: invoiceId,
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
          },
          select: {
            id: true,
            status: true,
            supplierId: true,
            invoiceNumber: true,
            invoiceDate: true,
            dueAt: true,
            totalAmount: true,
            items: {
              orderBy: { position: 'asc' },
              select: {
                productId: true,
                quantity: true,
                unitPrice: true,
                product: { select: { id: true } },
              },
            },
          },
        })
        if (!invoice) throw new InvoicesFailure('not_found', 'Invoice not found')
        if (invoice.status === 'confirmed') return
        if (
          invoice.status !== 'review' ||
          !invoice.supplierId ||
          !invoice.invoiceNumber ||
          !invoice.invoiceDate ||
          !invoice.dueAt ||
          !invoice.totalAmount ||
          invoice.items.length === 0 ||
          invoice.items.some((item) => !item.productId || !item.product)
        ) {
          throw new InvoicesFailure('conflict', 'Review every invoice field and match every product')
        }

        const orderedItems = [...invoice.items].sort((left, right) =>
          left.productId!.localeCompare(right.productId!),
        )
        for (const item of orderedItems) {
          const productId = item.productId!
          await acquireInventoryBalanceMutationLock(tx, workspace.branchId, productId)
          const balance = await tx.inventoryBalance.findUnique({
            where: {
              branchId_productId: { branchId: workspace.branchId, productId },
            },
            select: { quantity: true },
          })
          const resultingQuantity = (balance?.quantity ?? new Prisma.Decimal(0)).plus(item.quantity)
          await tx.inventoryBalance.upsert({
            where: {
              branchId_productId: { branchId: workspace.branchId, productId },
            },
            create: { branchId: workspace.branchId, productId, quantity: resultingQuantity },
            update: { quantity: resultingQuantity },
          })
          await tx.inventoryProduct.update({
            where: { id: productId },
            data: { unitCost: item.unitPrice },
          })
          await tx.inventoryMovement.create({
            data: {
              organizationId: workspace.organizationId,
              branchId: workspace.branchId,
              productId,
              createdByUserId: userId,
              purchaseInvoiceId: invoice.id,
              type: 'receipt',
              quantityDelta: item.quantity,
              resultingQuantity,
              unitCost: item.unitPrice,
              occurredAt: invoice.invoiceDate,
              reference: invoice.invoiceNumber,
              note: 'Приход по подтверждённой накладной',
            },
          })
        }
        await tx.supplierLedgerEntry.create({
          data: {
            organizationId: workspace.organizationId,
            branchId: workspace.branchId,
            supplierId: invoice.supplierId,
            purchaseInvoiceId: invoice.id,
            type: 'invoice',
            amount: invoice.totalAmount,
            occurredAt: invoice.invoiceDate,
            dueAt: invoice.dueAt,
            reference: invoice.invoiceNumber,
            note: 'Создано из подтверждённой накладной',
          },
        })
        await tx.purchaseInvoice.update({
          where: { id: invoice.id },
          data: {
            status: 'confirmed',
            confirmedByUserId: userId,
            confirmedAt: now,
          },
        })
      })
      return readInvoice(db, workspace.organizationId, workspace.branchId, invoiceId)
    },
  }
}

const dayMs = 24 * 60 * 60 * 1000

const invoiceSummarySelect = {
  id: true,
  branchId: true,
  status: true,
  recognitionMode: true,
  recognitionConfidence: true,
  supplierId: true,
  supplier: { select: { name: true } },
  invoiceNumber: true,
  invoiceDate: true,
  dueAt: true,
  totalAmount: true,
  createdAt: true,
  confirmedAt: true,
  createdBy: { select: { displayName: true, email: true } },
  confirmedBy: { select: { displayName: true, email: true } },
} as const

const invoiceDetailSelect = {
  ...invoiceSummarySelect,
  items: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      productId: true,
      detectedName: true,
      unit: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
    },
  },
} as const

async function readInvoice(
  db: DbClient,
  organizationId: string,
  branchId: string,
  invoiceId: string,
) {
  const invoice = await db.purchaseInvoice.findFirst({
    where: { id: invoiceId, organizationId, branchId },
    select: invoiceDetailSelect,
  })
  if (!invoice) throw new InvoicesFailure('not_found', 'Invoice not found')
  return {
    ...summaryDto(invoice),
    imageUrl: null,
    items: invoice.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      detectedName: item.detectedName,
      unit: item.unit,
      quantity: quantity(item.quantity),
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
    })),
  } satisfies PurchaseInvoice
}

function summaryDto(invoice: {
  id: string
  branchId: string
  status: PurchaseInvoice['status']
  recognitionMode: PurchaseInvoice['recognitionMode']
  recognitionConfidence: Prisma.Decimal | null
  supplierId: string | null
  supplier: { name: string } | null
  invoiceNumber: string | null
  invoiceDate: Date | null
  dueAt: Date | null
  totalAmount: Prisma.Decimal | null
  createdAt: Date
  confirmedAt: Date | null
  createdBy: { displayName: string | null; email: string } | null
  confirmedBy: { displayName: string | null; email: string } | null
}) {
  return {
    id: invoice.id,
    branchId: invoice.branchId,
    status: invoice.status,
    recognitionMode: invoice.recognitionMode,
    recognitionConfidence: invoice.recognitionConfidence
      ? Number(invoice.recognitionConfidence)
      : null,
    supplierId: invoice.supplierId,
    supplierName: invoice.supplier?.name ?? null,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: dateOnly(invoice.invoiceDate),
    dueAt: dateOnly(invoice.dueAt),
    totalAmount: invoice.totalAmount ? money(invoice.totalAmount) : null,
    createdByName: personName(invoice.createdBy),
    confirmedByName: invoice.confirmedBy ? personName(invoice.confirmedBy) : null,
    createdAt: invoice.createdAt.toISOString(),
    confirmedAt: invoice.confirmedAt?.toISOString() ?? null,
  }
}

function reviewedItemRows(invoiceId: string, input: UpdatePurchaseInvoiceRequest) {
  return input.items.map((item, position) => {
    const quantityValue = new Prisma.Decimal(item.quantity)
    const unitPrice = new Prisma.Decimal(item.unitPrice)
    return {
      invoiceId,
      productId: item.productId,
      position,
      detectedName: item.detectedName,
      unit: item.unit,
      quantity: quantityValue,
      unitPrice,
      lineTotal: quantityValue.mul(unitPrice).toDecimalPlaces(2),
    }
  })
}

function preferredProducts<
  Product extends { id: string; name: string; unit: InventoryUnit; unitCost: Prisma.Decimal },
>(products: Product[]) {
  const names = ['Лосось филе', 'Огурцы свежие', 'Сливки 33%']
  const preferred = names.flatMap((name) => {
    const product = products.find((item) => item.name === name)
    return product ? [product] : []
  })
  return (preferred.length > 0 ? preferred : products).slice(0, 3)
}

function uploadRecord(row: {
  id: string
  objectKey: string
  contentType: string
  byteSize: number
  uploadExpiresAt: Date
  status: PurchaseInvoice['status']
}): InvoiceUploadRecord {
  return {
    ...row,
    contentType: row.contentType as InvoiceUploadRecord['contentType'],
  }
}

async function workspaceContext(db: DbClient, userId: string) {
  const workspace = await resolveActiveWorkspace(db, userId)
  if (!workspace) {
    throw new InvoicesFailure('not_found', 'KitchenFlow workspace not found')
  }
  return workspace
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function money(value: Prisma.Decimal) {
  return value.toFixed(2)
}

function quantity(value: Prisma.Decimal) {
  return value.toFixed(3)
}

function dateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null
}

function personName(person: { displayName: string | null; email: string } | null) {
  return person?.displayName ?? person?.email ?? 'Сотрудник'
}
