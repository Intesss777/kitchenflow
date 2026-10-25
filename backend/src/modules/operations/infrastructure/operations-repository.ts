import type {
  OperationsDashboardResponse,
  Supplier,
  SupplierDetailResponse,
  SupplierLedgerEntry,
} from '@kitchenflow/contracts'

import type { DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import { resolveActiveWorkspace } from '../../workspace'
import type { OperationsDashboardReader, SuppliersRepository } from '../application/ports'
import { OperationsFailure } from '../domain/errors'

const dayMs = 24 * 60 * 60 * 1000

export function createPrismaOperationsRepository(
  db: DbClient,
): OperationsDashboardReader & SuppliersRepository {
  return {
    async readDashboard(userId, query, now) {
      const workspace = await resolveActiveWorkspace(db, userId)
      if (!workspace || workspace.role !== 'owner') return null

      const { branchId, organizationId } = workspace
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const activityStart = startOfUtcDay(new Date(now.getTime() - 6 * dayMs))
      const rangeStart = query.from
        ? new Date(`${query.from}T00:00:00.000Z`)
        : monthStart
      const rangeEnd = query.to
        ? new Date(`${query.to}T00:00:00.000Z`)
        : startOfUtcDay(now)
      const rangeEndExclusive = new Date(rangeEnd.getTime() + dayMs)
      const entryStart = new Date(Math.min(monthStart.getTime(), activityStart.getTime(), rangeStart.getTime()))
      const [suppliers, recentEntries, periodEntries, confirmedShifts] = await db.$transaction([
        db.supplier.findMany({
          where: { organizationId, isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            legalName: true,
            taxId: true,
            registrationReasonCode: true,
            registrationNumber: true,
            legalAddress: true,
            bankName: true,
            bankBik: true,
            correspondentAccount: true,
            settlementAccount: true,
            contactName: true,
            phone: true,
            whatsappPhone: true,
            paymentTermsDays: true,
            ledgerEntries: {
              where: { branchId },
              orderBy: { occurredAt: 'asc' },
              select: { amount: true, dueAt: true, type: true },
            },
          },
        }),
        db.supplierLedgerEntry.findMany({
          where: { organizationId, branchId },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 6,
          select: {
            id: true,
            amount: true,
            occurredAt: true,
            reference: true,
            type: true,
            supplier: { select: { name: true } },
          },
        }),
        db.supplierLedgerEntry.findMany({
          where: { organizationId, branchId, occurredAt: { gte: entryStart } },
          select: { amount: true, occurredAt: true, type: true },
        }),
        db.salesShift.findMany({
          where: {
            organizationId,
            branchId,
            status: 'confirmed',
            shiftDate: { gte: rangeStart, lt: rangeEndExclusive },
          },
          orderBy: { shiftDate: 'asc' },
          select: {
            shiftDate: true,
            lines: {
              select: {
                quantity: true,
                dish: {
                  select: {
                    sellingPrice: true,
                    ingredients: {
                      select: {
                        quantity: true,
                        product: { select: { unitCost: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      ])

      const supplierRows = suppliers.map((supplier) => {
        const balance = supplier.ledgerEntries.reduce(
          (total, entry) => total + signedAmount(entry.type, Number(entry.amount)),
          0,
        )
        const unpaidDueDates = supplier.ledgerEntries
          .filter((entry) => entry.type === 'invoice' && entry.dueAt)
          .map((entry) => entry.dueAt!)
          .sort((a, b) => a.getTime() - b.getTime())
        const nextDueAt = balance > 0 ? (unpaidDueDates[0] ?? null) : null
        return {
          id: supplier.id,
          name: supplier.name,
          legalName: supplier.legalName,
          taxId: supplier.taxId,
          registrationReasonCode: supplier.registrationReasonCode,
          registrationNumber: supplier.registrationNumber,
          legalAddress: supplier.legalAddress,
          bankName: supplier.bankName,
          bankBik: supplier.bankBik,
          correspondentAccount: supplier.correspondentAccount,
          settlementAccount: supplier.settlementAccount,
          contactName: supplier.contactName,
          phone: supplier.phone,
          whatsappPhone: supplier.whatsappPhone,
          paymentTermsDays: supplier.paymentTermsDays,
          balance: money(balance),
          isOverdue: Boolean(nextDueAt && nextDueAt < now),
          nextDueAt: nextDueAt?.toISOString() ?? null,
        }
      })

      const monthEntries = periodEntries.filter((entry) => entry.occurredAt >= monthStart)
      const invoicesThisMonth = sumByType(monthEntries, 'invoice')
      const paymentsThisMonth = sumByType(monthEntries, 'payment')
      const analyticsEntries = periodEntries.filter(
        (entry) => entry.occurredAt >= rangeStart && entry.occurredAt < rangeEndExclusive,
      )
      const analytics = dashboardAnalytics({
        entries: analyticsEntries,
        from: rangeStart,
        shifts: confirmedShifts,
        to: rangeEnd,
      })

      return {
        workspace: {
          organizationName: workspace.organizationName,
          branchName: workspace.branchName,
        },
        metrics: {
          supplierDebt: money(
            supplierRows.reduce((total, supplier) => total + Number(supplier.balance), 0),
          ),
          invoicesThisMonth: money(invoicesThisMonth),
          paymentsThisMonth: money(paymentsThisMonth),
          activeSuppliers: supplierRows.length,
          overdueSuppliers: supplierRows.filter((supplier) => supplier.isOverdue).length,
        },
        suppliers: supplierRows.sort(
          (a, b) => Number(b.balance) - Number(a.balance),
        ),
        recentEntries: recentEntries.map((entry) => ({
          id: entry.id,
          supplierName: entry.supplier.name,
          type: entry.type,
          amount: money(Number(entry.amount)),
          occurredAt: entry.occurredAt.toISOString(),
          reference: entry.reference,
        })),
        activity: Array.from({ length: 7 }, (_, offset) => {
          const date = new Date(activityStart.getTime() + offset * dayMs)
          const dateKey = isoDate(date)
          const entries = periodEntries.filter(
            (entry) => isoDate(entry.occurredAt) === dateKey,
          )
          return {
            date: dateKey,
            invoices: money(sumByType(entries, 'invoice')),
            payments: money(sumByType(entries, 'payment')),
          }
        }),
        analytics,
      } satisfies OperationsDashboardResponse
    },

    async createSupplier(userId, input, now) {
      const { organizationId } = await financeWorkspace(db, userId)
      try {
        const supplier = await db.supplier.create({
          data: {
            organizationId,
            name: input.name,
            legalName: input.legalName,
            taxId: input.taxId,
            registrationReasonCode: input.registrationReasonCode,
            registrationNumber: input.registrationNumber,
            legalAddress: input.legalAddress,
            bankName: input.bankName,
            bankBik: input.bankBik,
            correspondentAccount: input.correspondentAccount,
            settlementAccount: input.settlementAccount,
            contactName: input.contactName,
            phone: input.phone,
            whatsappPhone: input.whatsappPhone,
            paymentTermsDays: input.paymentTermsDays,
          },
          select: supplierRecordSelect,
        })
        return supplierSummary(supplier, now)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new OperationsFailure('conflict', 'Supplier with this name already exists')
        }
        throw error
      }
    },

    async updateSupplier(userId, supplierId, input, now) {
      const { branchId, organizationId } = await financeWorkspace(db, userId)
      try {
        const supplier = await db.supplier.update({
          where: { id: supplierId, organizationId, isActive: true },
          data: {
            name: input.name,
            legalName: input.legalName,
            taxId: input.taxId,
            registrationReasonCode: input.registrationReasonCode,
            registrationNumber: input.registrationNumber,
            legalAddress: input.legalAddress,
            bankName: input.bankName,
            bankBik: input.bankBik,
            correspondentAccount: input.correspondentAccount,
            settlementAccount: input.settlementAccount,
            contactName: input.contactName,
            phone: input.phone,
            whatsappPhone: input.whatsappPhone,
            paymentTermsDays: input.paymentTermsDays,
          },
          select: {
            ...supplierRecordSelect,
            ledgerEntries: {
              where: { branchId },
              orderBy: { occurredAt: 'asc' },
              select: { amount: true, dueAt: true, type: true },
            },
          },
        })
        return supplierSummary(supplier, now)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new OperationsFailure('not_found', 'Supplier not found')
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new OperationsFailure('conflict', 'Supplier with this name already exists')
        }
        throw error
      }
    },

    async createLedgerEntry(userId, supplierId, input, now) {
      const { branchId, organizationId } = await financeWorkspace(db, userId)
      const supplier = await db.supplier.findFirst({
        where: { id: supplierId, organizationId, isActive: true },
        select: { id: true, name: true },
      })
      if (!supplier) throw new OperationsFailure('not_found', 'Supplier not found')
      const entry = await db.supplierLedgerEntry.create({
        data: {
          organizationId,
          branchId,
          supplierId,
          type: input.type,
          amount: input.amount,
          occurredAt: new Date(input.occurredAt),
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          reference: input.reference,
          note: input.note,
        },
        select: ledgerEntrySelect,
      })
      return ledgerEntryDto(entry, supplier.name)
    },

    async readSupplier(userId, supplierId, now) {
      const { branchId, organizationId } = await financeWorkspace(db, userId)
      const supplier = await db.supplier.findFirst({
        where: { id: supplierId, organizationId, isActive: true },
        select: {
          ...supplierRecordSelect,
          ledgerEntries: {
            where: { branchId },
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            select: ledgerEntrySelect,
          },
        },
      })
      if (!supplier) throw new OperationsFailure('not_found', 'Supplier not found')
      return {
        supplier: supplierSummary(supplier, now),
        entries: supplier.ledgerEntries.map((entry) => ledgerEntryDto(entry, supplier.name)),
      } satisfies SupplierDetailResponse
    },
  }
}

const supplierRecordSelect = {
  id: true,
  name: true,
  legalName: true,
  taxId: true,
  registrationReasonCode: true,
  registrationNumber: true,
  legalAddress: true,
  bankName: true,
  bankBik: true,
  correspondentAccount: true,
  settlementAccount: true,
  contactName: true,
  phone: true,
  whatsappPhone: true,
  paymentTermsDays: true,
  ledgerEntries: {
    orderBy: { occurredAt: 'asc' as const },
    select: { amount: true, dueAt: true, type: true },
  },
} as const

const ledgerEntrySelect = {
  id: true,
  amount: true,
  occurredAt: true,
  dueAt: true,
  reference: true,
  note: true,
  type: true,
} as const

async function financeWorkspace(db: DbClient, userId: string) {
  const workspace = await resolveActiveWorkspace(db, userId)
  if (!workspace || !['owner', 'administrator'].includes(workspace.role)) {
    throw new OperationsFailure('not_found', 'KitchenFlow workspace not found')
  }
  return workspace
}

function supplierSummary(
  supplier: {
    id: string
    name: string
    legalName: string | null
    taxId: string | null
    registrationReasonCode: string | null
    registrationNumber: string | null
    legalAddress: string | null
    bankName: string | null
    bankBik: string | null
    correspondentAccount: string | null
    settlementAccount: string | null
    contactName: string | null
    phone: string | null
    whatsappPhone: string | null
    paymentTermsDays: number
    ledgerEntries: ReadonlyArray<{
      amount: unknown
      dueAt: Date | null
      type: 'invoice' | 'payment' | 'adjustment'
    }>
  },
  now: Date,
): Supplier {
  const balance = supplier.ledgerEntries.reduce(
    (total, entry) => total + signedAmount(entry.type, Number(entry.amount)),
    0,
  )
  const nextDueAt = balance > 0
    ? supplier.ledgerEntries
      .filter((entry) => entry.type === 'invoice' && entry.dueAt)
      .map((entry) => entry.dueAt!)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null
    : null
  return {
    id: supplier.id,
    name: supplier.name,
    legalName: supplier.legalName,
    taxId: supplier.taxId,
    registrationReasonCode: supplier.registrationReasonCode,
    registrationNumber: supplier.registrationNumber,
    legalAddress: supplier.legalAddress,
    bankName: supplier.bankName,
    bankBik: supplier.bankBik,
    correspondentAccount: supplier.correspondentAccount,
    settlementAccount: supplier.settlementAccount,
    contactName: supplier.contactName,
    phone: supplier.phone,
    whatsappPhone: supplier.whatsappPhone,
    paymentTermsDays: supplier.paymentTermsDays,
    balance: money(balance),
    isOverdue: Boolean(nextDueAt && nextDueAt < now),
    nextDueAt: nextDueAt?.toISOString() ?? null,
  }
}

function ledgerEntryDto(
  entry: {
    id: string
    amount: unknown
    occurredAt: Date
    dueAt: Date | null
    reference: string | null
    note: string | null
    type: 'invoice' | 'payment' | 'adjustment'
  },
  supplierName: string,
): SupplierLedgerEntry {
  return {
    id: entry.id,
    supplierName,
    type: entry.type,
    amount: money(Number(entry.amount)),
    occurredAt: entry.occurredAt.toISOString(),
    dueAt: entry.dueAt?.toISOString() ?? null,
    reference: entry.reference,
    note: entry.note,
  }
}

function signedAmount(type: 'invoice' | 'payment' | 'adjustment', amount: number) {
  return type === 'payment' ? -amount : amount
}

function sumByType(
  entries: ReadonlyArray<{ amount: unknown; type: string }>,
  type: 'invoice' | 'payment',
) {
  return entries
    .filter((entry) => entry.type === type)
    .reduce((total, entry) => total + Number(entry.amount), 0)
}

function money(value: number) {
  return value.toFixed(2)
}

function dashboardAnalytics(input: {
  entries: ReadonlyArray<{
    amount: unknown
    occurredAt: Date
    type: 'invoice' | 'payment' | 'adjustment'
  }>
  from: Date
  shifts: ReadonlyArray<{
    shiftDate: Date
    lines: ReadonlyArray<{
      quantity: number
      dish: {
        sellingPrice: Prisma.Decimal | null
        ingredients: ReadonlyArray<{
          quantity: Prisma.Decimal
          product: { unitCost: Prisma.Decimal }
        }>
      }
    }>
  }>
  to: Date
}): OperationsDashboardResponse['analytics'] {
  const dayCount = Math.floor((input.to.getTime() - input.from.getTime()) / dayMs) + 1
  const granularity = dayCount > 62 ? 'month' : 'day'
  const buckets = analyticsBuckets(input.from, input.to, granularity)
  const values = new Map(buckets.map((date) => [bucketKey(date, granularity), {
    date: isoDate(date),
    foodCost: 0,
    payments: 0,
    purchases: 0,
    revenue: 0,
  }]))

  for (const entry of input.entries) {
    const bucket = values.get(bucketKey(entry.occurredAt, granularity))
    if (!bucket) continue
    if (entry.type === 'invoice') bucket.purchases += Number(entry.amount)
    if (entry.type === 'payment') bucket.payments += Number(entry.amount)
  }

  let dishesSold = 0
  for (const shift of input.shifts) {
    const bucket = values.get(bucketKey(shift.shiftDate, granularity))
    if (!bucket) continue
    for (const line of shift.lines) {
      dishesSold += line.quantity
      bucket.revenue += Number(line.dish.sellingPrice ?? 0) * line.quantity
      bucket.foodCost += line.dish.ingredients.reduce(
        (total, ingredient) =>
          total + Number(ingredient.quantity) * Number(ingredient.product.unitCost) * line.quantity,
        0,
      )
    }
  }

  const series = [...values.values()].map((value) => ({
    date: value.date,
    revenue: money(value.revenue),
    foodCost: money(value.foodCost),
    purchases: money(value.purchases),
    payments: money(value.payments),
  }))
  const revenue = series.reduce((total, item) => total + Number(item.revenue), 0)
  const foodCost = series.reduce((total, item) => total + Number(item.foodCost), 0)
  const purchases = series.reduce((total, item) => total + Number(item.purchases), 0)
  const payments = series.reduce((total, item) => total + Number(item.payments), 0)
  const grossProfit = revenue - foodCost

  return {
    range: {
      from: isoDate(input.from),
      to: isoDate(input.to),
      granularity,
    },
    totals: {
      revenue: money(revenue),
      foodCost: money(foodCost),
      grossProfit: money(grossProfit),
      grossMarginPercent: revenue > 0 ? Math.round((grossProfit / revenue) * 1_000) / 10 : null,
      purchases: money(purchases),
      payments: money(payments),
      confirmedShifts: input.shifts.length,
      dishesSold,
    },
    series,
  }
}

function analyticsBuckets(from: Date, to: Date, granularity: 'day' | 'month') {
  const buckets: Date[] = []
  if (granularity === 'day') {
    for (let date = from; date <= to; date = new Date(date.getTime() + dayMs)) {
      buckets.push(date)
    }
    return buckets
  }
  for (
    let date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    date <= to;
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  ) {
    buckets.push(date)
  }
  return buckets
}

function bucketKey(date: Date, granularity: 'day' | 'month') {
  const value = isoDate(date)
  return granularity === 'day' ? value : value.slice(0, 7)
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
