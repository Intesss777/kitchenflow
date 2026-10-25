import type {
  CreateSupplierLedgerEntryRequest,
  CreateSupplierRequest,
  OperationsDashboardQuery,
  UpdateSupplierRequest,
} from '@kitchenflow/contracts'

import type { OperationsDashboardReader, SuppliersRepository } from './ports'

export class OperationsService {
  constructor(
    private readonly dependencies: {
      clock: { now(): Date }
      dashboardReader: OperationsDashboardReader
      suppliersRepository: SuppliersRepository
    },
  ) {}

  dashboard(userId: string, query: OperationsDashboardQuery) {
    return this.dependencies.dashboardReader.readDashboard(
      userId,
      query,
      this.dependencies.clock.now(),
    )
  }

  createSupplier(userId: string, input: CreateSupplierRequest) {
    return this.dependencies.suppliersRepository.createSupplier(
      userId,
      input,
      this.dependencies.clock.now(),
    )
  }

  updateSupplier(userId: string, supplierId: string, input: UpdateSupplierRequest) {
    return this.dependencies.suppliersRepository.updateSupplier(
      userId,
      supplierId,
      input,
      this.dependencies.clock.now(),
    )
  }

  createLedgerEntry(
    userId: string,
    supplierId: string,
    input: CreateSupplierLedgerEntryRequest,
  ) {
    return this.dependencies.suppliersRepository.createLedgerEntry(
      userId,
      supplierId,
      input,
      this.dependencies.clock.now(),
    )
  }

  supplier(userId: string, supplierId: string) {
    return this.dependencies.suppliersRepository.readSupplier(
      userId,
      supplierId,
      this.dependencies.clock.now(),
    )
  }
}
