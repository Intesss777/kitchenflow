import type {
  CreateSupplierLedgerEntryRequest,
  CreateSupplierRequest,
  OperationsDashboardQuery,
  OperationsDashboardResponse,
  Supplier,
  SupplierDetailResponse,
  SupplierLedgerEntry,
  UpdateSupplierRequest,
} from '@kitchenflow/contracts'

export type OperationsDashboardReader = {
  readDashboard(
    userId: string,
    query: OperationsDashboardQuery,
    now: Date,
  ): Promise<OperationsDashboardResponse | null>
}

export type SuppliersRepository = {
  createSupplier(userId: string, input: CreateSupplierRequest, now: Date): Promise<Supplier>
  updateSupplier(
    userId: string,
    supplierId: string,
    input: UpdateSupplierRequest,
    now: Date,
  ): Promise<Supplier>
  createLedgerEntry(
    userId: string,
    supplierId: string,
    input: CreateSupplierLedgerEntryRequest,
    now: Date,
  ): Promise<SupplierLedgerEntry>
  readSupplier(userId: string, supplierId: string, now: Date): Promise<SupplierDetailResponse>
}
