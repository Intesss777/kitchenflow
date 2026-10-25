import {
  createStaffEmployeeRequestSchema,
  createStaffEmployeeResponseSchema,
  createStaffEventRequestSchema,
  createStaffEventResponseSchema,
  staffOverviewResponseSchema,
  type CreateStaffEmployeeRequest,
  type CreateStaffEventRequest,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function getStaffOverview(
  transport: AuthenticatedTransport,
  month: string,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request(`/api/staff?month=${encodeURIComponent(month)}`, staffOverviewResponseSchema, options)
}

export function createStaffEmployee(transport: AuthenticatedTransport, input: CreateStaffEmployeeRequest) {
  return transport.request('/api/staff/employees', createStaffEmployeeResponseSchema, {
    method: 'POST',
    body: createStaffEmployeeRequestSchema.parse(input),
  })
}

export function createStaffEvent(
  transport: AuthenticatedTransport,
  employeeId: string,
  input: CreateStaffEventRequest,
) {
  return transport.request(
    `/api/staff/employees/${encodeURIComponent(employeeId)}/events`,
    createStaffEventResponseSchema,
    { method: 'POST', body: createStaffEventRequestSchema.parse(input) },
  )
}
