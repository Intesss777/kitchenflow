import type {
  CreateStaffEmployeeRequest,
  CreateStaffEventRequest,
  StaffEmployee,
  StaffEvent,
  StaffOverviewResponse,
} from '@kitchenflow/contracts'

import type { DbClient } from '../../../db'
import type { Prisma } from '../../../generated/prisma/client'
import { resolveActiveWorkspace } from '../../workspace'
import type { StaffRepository } from '../application/ports'
import { StaffFailure } from '../domain/errors'

export function createPrismaStaffRepository(db: DbClient): StaffRepository {
  return {
    async readOverview(userId, month) {
      const workspace = await workspaceContext(db, userId)
      const { start, end } = monthRange(month)
      const [employees, events] = await db.$transaction([
        db.staffEmployee.findMany({
          where: { branchId: workspace.branchId, isActive: true },
          orderBy: { name: 'asc' },
          select: employeeSelect,
        }),
        db.staffEvent.findMany({
          where: {
            branchId: workspace.branchId,
            occurredOn: { gte: start, lt: end },
          },
          orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
          select: eventSelect,
        }),
      ])
      const eventRows = events.map(eventDto)
      const fineTotal = events.reduce(
        (total, event) => total + Number(event.fineAmount ?? 0),
        0,
      )
      return {
        workspace: {
          organizationName: workspace.organizationName,
          branchName: workspace.branchName,
        },
        month,
        metrics: {
          activeEmployees: employees.length,
          latenessCount: events.filter((event) => event.type === 'lateness').length,
          fineTotal: fineTotal.toFixed(2),
        },
        employees,
        events: eventRows,
      } satisfies StaffOverviewResponse
    },

    async createEmployee(userId, input) {
      const workspace = await workspaceContext(db, userId)
      const employee = await db.staffEmployee.create({
        data: {
          organizationId: workspace.organizationId,
          branchId: workspace.branchId,
          name: input.name,
          position: input.position,
        },
        select: employeeSelect,
      })
      return employee satisfies StaffEmployee
    },

    async createEvent(userId, employeeId, input) {
      const workspace = await workspaceContext(db, userId)
      const employee = await db.staffEmployee.findFirst({
        where: {
          id: employeeId,
          organizationId: workspace.organizationId,
          branchId: workspace.branchId,
          isActive: true,
        },
        select: { id: true },
      })
      if (!employee) throw new StaffFailure('Сотрудник не найден')
      const event = await db.staffEvent.create({
        data: {
          organizationId: workspace.organizationId,
          branchId: workspace.branchId,
          employeeId,
          createdByUserId: userId,
          type: input.type,
          occurredOn: new Date(`${input.occurredOn}T00:00:00.000Z`),
          arrivalTime: input.arrivalTime,
          fineAmount: input.fineAmount,
          reason: input.reason,
        },
        select: eventSelect,
      })
      return eventDto(event)
    },
  }
}

const employeeSelect = {
  id: true,
  name: true,
  position: true,
  isActive: true,
} as const

const eventSelect = {
  id: true,
  employeeId: true,
  type: true,
  occurredOn: true,
  arrivalTime: true,
  fineAmount: true,
  reason: true,
  createdAt: true,
  createdBy: { select: { displayName: true, email: true } },
} as const

type EventRecord = Prisma.StaffEventGetPayload<{ select: typeof eventSelect }>

function eventDto(event: EventRecord): StaffEvent {
  return {
    id: event.id,
    employeeId: event.employeeId,
    type: event.type,
    occurredOn: event.occurredOn.toISOString().slice(0, 10),
    arrivalTime: event.arrivalTime,
    fineAmount: event.fineAmount?.toFixed(2) ?? null,
    reason: event.reason,
    createdByName: event.createdBy?.displayName ?? event.createdBy?.email ?? 'Сотрудник',
    createdAt: event.createdAt.toISOString(),
  }
}

async function workspaceContext(db: DbClient, userId: string) {
  const workspace = await resolveActiveWorkspace(db, userId)
  if (!workspace) throw new StaffFailure('Рабочее пространство KitchenFlow не найдено')
  return workspace
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return {
    start: new Date(Date.UTC(year!, monthNumber! - 1, 1)),
    end: new Date(Date.UTC(year!, monthNumber!, 1)),
  }
}
