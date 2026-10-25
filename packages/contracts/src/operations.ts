import { z } from 'zod'

export const moneyAmountSchema = z.string().regex(/^-?\d+\.\d{2}$/)
export const positiveMoneyAmountSchema = z
  .string()
  .regex(/^\d{1,12}\.\d{2}$/)
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero')

const dashboardDateSchema = z.string().date()

export const operationsDashboardQuerySchema = z
  .object({
    from: dashboardDateSchema.optional(),
    to: dashboardDateSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.from === undefined) !== (value.to === undefined)) {
      context.addIssue({ code: 'custom', message: 'Both range dates are required together' })
      return
    }
    if (!value.from || !value.to) return
    const from = Date.parse(`${value.from}T00:00:00.000Z`)
    const to = Date.parse(`${value.to}T00:00:00.000Z`)
    if (to < from) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'End date must not precede start date' })
      return
    }
    if ((to - from) / 86_400_000 > 366) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'Dashboard range cannot exceed 367 days' })
    }
  })

const dashboardAnalyticsSchema = z
  .object({
    range: z
      .object({
        from: dashboardDateSchema,
        to: dashboardDateSchema,
        granularity: z.enum(['day', 'month']),
      })
      .strict(),
    totals: z
      .object({
        revenue: moneyAmountSchema,
        foodCost: moneyAmountSchema,
        grossProfit: moneyAmountSchema,
        grossMarginPercent: z.number().nullable(),
        purchases: moneyAmountSchema,
        payments: moneyAmountSchema,
        confirmedShifts: z.number().int().nonnegative(),
        dishesSold: z.number().int().nonnegative(),
      })
      .strict(),
    series: z.array(
      z
        .object({
          date: dashboardDateSchema,
          revenue: moneyAmountSchema,
          foodCost: moneyAmountSchema,
          purchases: moneyAmountSchema,
          payments: moneyAmountSchema,
        })
        .strict(),
    ),
  })
  .strict()

export const supplierSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    legalName: z.string().nullable(),
    taxId: z.string().nullable(),
    registrationReasonCode: z.string().nullable(),
    registrationNumber: z.string().nullable(),
    legalAddress: z.string().nullable(),
    bankName: z.string().nullable(),
    bankBik: z.string().nullable(),
    correspondentAccount: z.string().nullable(),
    settlementAccount: z.string().nullable(),
    contactName: z.string().nullable(),
    phone: z.string().nullable(),
    whatsappPhone: z.string().nullable(),
    paymentTermsDays: z.number().int().min(0).max(365),
    balance: moneyAmountSchema,
    isOverdue: z.boolean(),
    nextDueAt: z.string().datetime().nullable(),
  })
  .strict()

export const supplierLedgerEntrySchema = z
  .object({
    id: z.string().uuid(),
    supplierName: z.string(),
    type: z.enum(['invoice', 'payment', 'adjustment']),
    amount: moneyAmountSchema,
    occurredAt: z.string().datetime(),
    dueAt: z.string().datetime().nullable(),
    reference: z.string().nullable(),
    note: z.string().nullable(),
  })
  .strict()

export const operationsDashboardResponseSchema = z
  .object({
    workspace: z
      .object({
        organizationName: z.string(),
        branchName: z.string(),
      })
      .strict(),
    metrics: z
      .object({
        supplierDebt: moneyAmountSchema,
        invoicesThisMonth: moneyAmountSchema,
        paymentsThisMonth: moneyAmountSchema,
        activeSuppliers: z.number().int().nonnegative(),
        overdueSuppliers: z.number().int().nonnegative(),
      })
      .strict(),
    suppliers: z.array(supplierSchema),
    recentEntries: z.array(
      z
        .object({
          id: z.string().uuid(),
          supplierName: z.string(),
          type: z.enum(['invoice', 'payment', 'adjustment']),
          amount: moneyAmountSchema,
          occurredAt: z.string().datetime(),
          reference: z.string().nullable(),
        })
        .strict(),
    ),
    activity: z.array(
      z
        .object({
          date: z.string().date(),
          invoices: moneyAmountSchema,
          payments: moneyAmountSchema,
        })
        .strict(),
    ),
    analytics: dashboardAnalyticsSchema,
  })
  .strict()

const optionalNullableText = (maximum: number) =>
  z.union([z.string().trim().min(1).max(maximum), z.null()]).optional().default(null)

const optionalNullableDigits = (pattern: RegExp, message: string) =>
  z.union([z.string().trim().regex(pattern, message), z.null()]).optional().default(null)

export const createSupplierRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    legalName: optionalNullableText(200),
    taxId: optionalNullableDigits(/^(\d{10}|\d{12})$/, 'ИНН должен содержать 10 или 12 цифр'),
    registrationReasonCode: optionalNullableDigits(/^\d{9}$/, 'КПП должен содержать 9 цифр'),
    registrationNumber: optionalNullableDigits(/^(\d{13}|\d{15})$/, 'ОГРН или ОГРНИП должен содержать 13 или 15 цифр'),
    legalAddress: optionalNullableText(300),
    bankName: optionalNullableText(200),
    bankBik: optionalNullableDigits(/^\d{9}$/, 'БИК должен содержать 9 цифр'),
    correspondentAccount: optionalNullableDigits(/^\d{20}$/, 'Корреспондентский счёт должен содержать 20 цифр'),
    settlementAccount: optionalNullableDigits(/^\d{20}$/, 'Расчётный счёт должен содержать 20 цифр'),
    contactName: optionalNullableText(120),
    phone: optionalNullableText(40),
    whatsappPhone: optionalNullableText(24),
    paymentTermsDays: z.number().int().min(0).max(365).default(0),
  })
  .strict()

export const createSupplierResponseSchema = z
  .object({
    supplier: supplierSchema,
  })
  .strict()

export const updateSupplierRequestSchema = createSupplierRequestSchema
export const updateSupplierResponseSchema = createSupplierResponseSchema

export const supplierParamsSchema = z
  .object({ supplierId: z.string().uuid() })
  .strict()

export const createSupplierLedgerEntryRequestSchema = z
  .object({
    type: z.enum(['invoice', 'payment']),
    amount: positiveMoneyAmountSchema,
    occurredAt: z.string().datetime(),
    dueAt: z.string().datetime().nullable().optional().default(null),
    reference: optionalNullableText(120),
    note: optionalNullableText(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === 'invoice' && value.dueAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['dueAt'],
        message: 'Invoice due date is required',
      })
    }
  })

export const createSupplierLedgerEntryResponseSchema = z
  .object({ entry: supplierLedgerEntrySchema })
  .strict()

export const supplierDetailResponseSchema = z
  .object({
    supplier: supplierSchema,
    entries: z.array(supplierLedgerEntrySchema),
  })
  .strict()

export type OperationsDashboardResponse = z.infer<typeof operationsDashboardResponseSchema>
export type OperationsDashboardQuery = z.infer<typeof operationsDashboardQuerySchema>
export type Supplier = z.infer<typeof supplierSchema>
export type SupplierLedgerEntry = z.infer<typeof supplierLedgerEntrySchema>
export type CreateSupplierRequest = z.infer<typeof createSupplierRequestSchema>
export type CreateSupplierResponse = z.infer<typeof createSupplierResponseSchema>
export type UpdateSupplierRequest = z.infer<typeof updateSupplierRequestSchema>
export type UpdateSupplierResponse = z.infer<typeof updateSupplierResponseSchema>
export type CreateSupplierLedgerEntryRequest = z.infer<typeof createSupplierLedgerEntryRequestSchema>
export type CreateSupplierLedgerEntryResponse = z.infer<typeof createSupplierLedgerEntryResponseSchema>
export type SupplierDetailResponse = z.infer<typeof supplierDetailResponseSchema>
