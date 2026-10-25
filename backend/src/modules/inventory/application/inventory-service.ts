import type {
  CreateInventoryMovementRequest,
  CreateInventoryProductRequest,
  UpdateInventoryProductRequest,
} from '@kitchenflow/contracts'

import type { InventoryRepository } from './ports'

export class InventoryService {
  constructor(
    private readonly dependencies: {
      clock: { now(): Date }
      repository: InventoryRepository
    },
  ) {}

  overview(userId: string) {
    return this.dependencies.repository.readOverview(userId, this.dependencies.clock.now())
  }

  createProduct(userId: string, input: CreateInventoryProductRequest) {
    return this.dependencies.repository.createProduct(
      userId,
      input,
      this.dependencies.clock.now(),
    )
  }

  createMovement(
    userId: string,
    productId: string,
    input: CreateInventoryMovementRequest,
  ) {
    return this.dependencies.repository.createMovement(
      userId,
      productId,
      input,
      this.dependencies.clock.now(),
    )
  }

  updateProduct(
    userId: string,
    productId: string,
    input: UpdateInventoryProductRequest,
  ) {
    return this.dependencies.repository.updateProduct(
      userId,
      productId,
      input,
      this.dependencies.clock.now(),
    )
  }

  archiveProduct(userId: string, productId: string) {
    return this.dependencies.repository.archiveProduct(userId, productId)
  }

  product(userId: string, productId: string) {
    return this.dependencies.repository.readProduct(userId, productId)
  }
}
