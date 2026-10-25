import { describe, expect, test } from 'bun:test'

import {
  createSupplierLedgerEntryRequestSchema,
  createSupplierRequestSchema,
  operationsDashboardQuerySchema,
  operationsDashboardResponseSchema,
} from './operations'

describe('operations contracts', () => {
  test('normalizes a supplier and rejects unknown fields', () => {
    expect(createSupplierRequestSchema.parse({
      name: '  Фреш Маркет  ',
      contactName: '  Анна  ',
      paymentTermsDays: 7,
    })).toEqual({
      name: 'Фреш Маркет',
      legalName: null,
      taxId: null,
      registrationReasonCode: null,
      registrationNumber: null,
      legalAddress: null,
      bankName: null,
      bankBik: null,
      correspondentAccount: null,
      settlementAccount: null,
      contactName: 'Анна',
      phone: null,
      whatsappPhone: null,
      paymentTermsDays: 7,
    })
    expect(createSupplierRequestSchema.parse({
      name: 'Фреш Маркет',
      legalName: 'ООО «Фреш Маркет»',
      taxId: '7701234567',
      registrationReasonCode: '770101001',
      registrationNumber: '1027700123456',
      legalAddress: 'Москва, ул. Примерная, 1',
      bankName: 'АО «Банк»',
      bankBik: '044525000',
      correspondentAccount: '30101810000000000000',
      settlementAccount: '40702810000000000000',
    })).toMatchObject({
      legalName: 'ООО «Фреш Маркет»',
      taxId: '7701234567',
      registrationReasonCode: '770101001',
      registrationNumber: '1027700123456',
      bankBik: '044525000',
      settlementAccount: '40702810000000000000',
    })
    expect(createSupplierRequestSchema.safeParse({
      name: 'Поставщик',
      taxId: '123',
    }).success).toBe(false)
    expect(createSupplierRequestSchema.safeParse({ name: 'Поставщик', unknown: true }).success)
      .toBe(false)
  })

  test('requires a positive money amount and a due date for invoices', () => {
    const base = {
      amount: '1200.00',
      occurredAt: '2026-10-10T12:00:00.000Z',
      reference: null,
      note: null,
    }
    expect(createSupplierLedgerEntryRequestSchema.safeParse({ ...base, type: 'invoice' }).success)
      .toBe(false)
    expect(createSupplierLedgerEntryRequestSchema.parse({
      ...base,
      type: 'invoice',
      dueAt: '2026-10-17T12:00:00.000Z',
    }).amount).toBe('1200.00')
    expect(createSupplierLedgerEntryRequestSchema.safeParse({
      ...base,
      type: 'payment',
      amount: '0.00',
    }).success).toBe(false)
  })

  test('keeps money as decimal strings in dashboard responses', () => {
    const parsed = operationsDashboardResponseSchema.safeParse({
      workspace: { organizationName: 'KitchenFlow', branchName: 'Основной' },
      metrics: {
        supplierDebt: 1200,
        invoicesThisMonth: '1200.00',
        paymentsThisMonth: '0.00',
        activeSuppliers: 1,
        overdueSuppliers: 0,
      },
      suppliers: [],
      recentEntries: [],
      activity: [],
      analytics: {
        range: { from: '2026-10-01', to: '2026-10-14', granularity: 'day' },
        totals: {
          revenue: 1200,
          foodCost: '300.00',
          grossProfit: '900.00',
          grossMarginPercent: 75,
          purchases: '1200.00',
          payments: '0.00',
          confirmedShifts: 1,
          dishesSold: 8,
        },
        series: [],
      },
    })
    expect(parsed.success).toBe(false)
  })

  test('accepts a bounded dashboard date range and rejects invalid ranges', () => {
    expect(operationsDashboardQuerySchema.parse({
      from: '2026-10-01',
      to: '2026-10-14',
    })).toEqual({ from: '2026-10-01', to: '2026-10-14' })

    expect(operationsDashboardQuerySchema.safeParse({
      from: '2026-10-14',
      to: '2026-10-01',
    }).success).toBe(false)
    expect(operationsDashboardQuerySchema.safeParse({
      from: '2024-01-01',
      to: '2026-10-14',
    }).success).toBe(false)
  })
})
