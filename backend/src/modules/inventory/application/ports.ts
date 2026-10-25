import type {
  CreateInventoryMovementRequest,
  CreateInventoryMovementResponse,
  CreateInventoryProductRequest,
  InventoryOverviewResponse,
  InventoryProduct,
  InventoryProductDetailResponse,
  UpdateInventoryProductRequest,
} from '@kitchenflow/contracts'

export type InventoryRepository = {
  readOverview(userId: string, now: Date): Promise<InventoryOverviewResponse>
  createProduct(
    userId: string,
    input: CreateInventoryProductRequest,
    now: Date,
  ): Promise<InventoryProduct>
  updateProduct(
    userId: string,
    productId: string,
    input: UpdateInventoryProductRequest,
    now: Date,
  ): Promise<InventoryProduct>
  archiveProduct(userId: string, productId: string): Promise<void>
  createMovement(
    userId: string,
    productId: string,
    input: CreateInventoryMovementRequest,
    now: Date,
  ): Promise<CreateInventoryMovementResponse>
  readProduct(userId: string, productId: string): Promise<InventoryProductDetailResponse>
}
