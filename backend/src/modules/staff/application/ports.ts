import type {
  CreateStaffEmployeeRequest,
  CreateStaffEventRequest,
  StaffEmployee,
  StaffEvent,
  StaffOverviewResponse,
} from '@kitchenflow/contracts'

export type StaffRepository = {
  readOverview(userId: string, month: string): Promise<StaffOverviewResponse>
  createEmployee(userId: string, input: CreateStaffEmployeeRequest): Promise<StaffEmployee>
  createEvent(userId: string, employeeId: string, input: CreateStaffEventRequest): Promise<StaffEvent>
}
