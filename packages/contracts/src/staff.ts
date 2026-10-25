import { z } from 'zod'

const moneySchema = z.string().regex(/^\d+\.\d{2}$/)
const positiveMoneySchema = moneySchema.refine((value) => Number(value) > 0, 'Fine must be greater than zero')
const dateSchema = z.string().date()
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const staffEventTypeSchema = z.enum(['lateness', 'fine'])

export const staffEmployeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  position: z.string(),
  isActive: z.boolean(),
}).strict()

export const staffEventSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  type: staffEventTypeSchema,
  occurredOn: dateSchema,
  arrivalTime: timeSchema.nullable(),
  fineAmount: moneySchema.nullable(),
  reason: z.string(),
  createdByName: z.string(),
  createdAt: z.string().datetime(),
}).strict()

export const staffOverviewQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
}).strict()

export const staffOverviewResponseSchema = z.object({
  workspace: z.object({ organizationName: z.string(), branchName: z.string() }).strict(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  metrics: z.object({
    activeEmployees: z.number().int().nonnegative(),
    latenessCount: z.number().int().nonnegative(),
    fineTotal: moneySchema,
  }).strict(),
  employees: z.array(staffEmployeeSchema),
  events: z.array(staffEventSchema),
}).strict()

export const createStaffEmployeeRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  position: z.string().trim().min(2).max(80),
}).strict()

export const createStaffEmployeeResponseSchema = z.object({ employee: staffEmployeeSchema }).strict()

export const staffEmployeeParamsSchema = z.object({ employeeId: z.string().uuid() }).strict()

export const createStaffEventRequestSchema = z.object({
  type: staffEventTypeSchema,
  occurredOn: dateSchema,
  arrivalTime: z.union([timeSchema, z.null()]).default(null),
  fineAmount: z.union([positiveMoneySchema, z.null()]).default(null),
  reason: z.string().trim().min(2).max(500),
}).strict().superRefine((value, context) => {
  if (value.type === 'lateness' && value.arrivalTime === null) {
    context.addIssue({ code: 'custom', path: ['arrivalTime'], message: 'Arrival time is required' })
  }
  if (value.type === 'fine' && value.fineAmount === null) {
    context.addIssue({ code: 'custom', path: ['fineAmount'], message: 'Fine amount is required' })
  }
  if (value.type === 'lateness' && value.fineAmount !== null) {
    context.addIssue({ code: 'custom', path: ['fineAmount'], message: 'Lateness does not include a fine' })
  }
  if (value.type === 'fine' && value.arrivalTime !== null) {
    context.addIssue({ code: 'custom', path: ['arrivalTime'], message: 'A fine does not include arrival time' })
  }
})

export const createStaffEventResponseSchema = z.object({ event: staffEventSchema }).strict()

export type StaffEventType = z.infer<typeof staffEventTypeSchema>
export type StaffEmployee = z.infer<typeof staffEmployeeSchema>
export type StaffEvent = z.infer<typeof staffEventSchema>
export type StaffOverviewResponse = z.infer<typeof staffOverviewResponseSchema>
export type CreateStaffEmployeeRequest = z.infer<typeof createStaffEmployeeRequestSchema>
export type CreateStaffEventRequest = z.infer<typeof createStaffEventRequestSchema>
