import type { CreateStaffEmployeeRequest, CreateStaffEventRequest } from '@kitchenflow/contracts'

import type { StaffRepository } from './ports'

export class StaffService {
  constructor(
    private readonly dependencies: {
      clock: { now(): Date }
      repository: StaffRepository
    },
  ) {}

  overview(userId: string, month?: string) {
    const resolvedMonth = month ?? this.dependencies.clock.now().toISOString().slice(0, 7)
    return this.dependencies.repository.readOverview(userId, resolvedMonth)
  }

  createEmployee(userId: string, input: CreateStaffEmployeeRequest) {
    return this.dependencies.repository.createEmployee(userId, input)
  }

  createEvent(userId: string, employeeId: string, input: CreateStaffEventRequest) {
    return this.dependencies.repository.createEvent(userId, employeeId, input)
  }
}
