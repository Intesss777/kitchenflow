import type {
  CreateDishPhotoUploadRequest,
  DishCard,
  DishCardsOverviewResponse,
  SaveDishCardRequest,
} from '@kitchenflow/contracts'

import type { PrivateStorage } from '../../../storage/port'

export type { PrivateStorage }

export type DishPhotoUploadRecord = {
  id: string
  objectKey: string
  contentType: CreateDishPhotoUploadRequest['contentType']
  byteSize: number
  expiresAt: Date
}

export type DishesRepository = {
  overview(userId: string): Promise<DishCardsOverviewResponse>
  create(userId: string, input: SaveDishCardRequest): Promise<DishCard>
  update(userId: string, dishId: string, input: SaveDishCardRequest): Promise<DishCard>
  createPhotoUpload(input: {
    userId: string
    dishId: string
    objectKey: string
    contentType: CreateDishPhotoUploadRequest['contentType']
    byteSize: number
    expiresAt: Date
  }): Promise<string>
  findPhotoUpload(userId: string, dishId: string, uploadId: string): Promise<DishPhotoUploadRecord | null>
  discardPhotoUpload(userId: string, dishId: string, uploadId: string): Promise<void>
  publishPhoto(userId: string, dishId: string, uploadId: string): Promise<{
    dish: DishCard
    replacedObjectKey: string | null
  }>
}

export type DishPhotoObjectKeyFactory = { create(now: Date): string }
