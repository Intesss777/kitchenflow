import type {
  CreateDishPhotoUploadRequest,
  CreateDishPhotoUploadResponse,
  DishCard,
  SaveDishCardRequest,
} from '@kitchenflow/contracts'

import {
  detectDishImageFormat,
  dishImageFormatMatches,
  dishImageSignatureByteLength,
} from '../domain/image-format'
import { DishesFailure } from '../domain/errors'
import type { DishPhotoObjectKeyFactory, DishesRepository, PrivateStorage } from './ports'

export class DishesService {
  constructor(private readonly dependencies: {
    clock: { now(): Date }
    objectKeys: DishPhotoObjectKeyFactory
    repository: DishesRepository
    storage: PrivateStorage
  }) {}

  overview(userId: string) {
    return this.dependencies.repository.overview(userId)
  }

  create(userId: string, input: SaveDishCardRequest) {
    return this.dependencies.repository.create(userId, input)
  }

  update(userId: string, dishId: string, input: SaveDishCardRequest) {
    return this.dependencies.repository.update(userId, dishId, input)
  }

  async createPhotoUpload(
    userId: string,
    dishId: string,
    input: CreateDishPhotoUploadRequest,
  ): Promise<CreateDishPhotoUploadResponse> {
    const objectKey = this.dependencies.objectKeys.create(this.dependencies.clock.now())
    const ticket = await this.dependencies.storage.createUploadUrl({
      key: objectKey,
      contentType: input.contentType,
      byteSize: input.byteSize,
    })
    const uploadId = await this.dependencies.repository.createPhotoUpload({
      userId,
      dishId,
      objectKey,
      contentType: input.contentType,
      byteSize: input.byteSize,
      expiresAt: new Date(ticket.expiresAt),
    })
    return {
      upload: {
        uploadId,
        method: ticket.method,
        url: ticket.url,
        headers: ticket.headers,
        contentLength: ticket.contentLength,
        expiresAt: ticket.expiresAt,
      },
    }
  }

  async finalizePhoto(userId: string, dishId: string, uploadId: string): Promise<DishCard> {
    const upload = await this.dependencies.repository.findPhotoUpload(userId, dishId, uploadId)
    if (!upload) throw new DishesFailure('not_found', 'Загрузка фото блюда не найдена')
    if (upload.expiresAt <= this.dependencies.clock.now()) {
      await this.rejectPhoto(userId, dishId, upload)
      throw new DishesFailure('expired', 'Время загрузки фото истекло. Выберите файл ещё раз')
    }
    const stored = await this.dependencies.storage.headObject(upload.objectKey)
    if (!stored) throw new DishesFailure('upload_incomplete', 'Фото блюда ещё не загрузилось')
    if (stored.contentLength !== upload.byteSize) {
      await this.rejectPhoto(userId, dishId, upload)
      throw new DishesFailure('rejected', 'Размер загруженного фото не совпадает с выбранным файлом')
    }
    const prefix = await this.dependencies.storage.readRange(upload.objectKey, {
      start: 0,
      end: dishImageSignatureByteLength - 1,
    })
    const detected = prefix ? detectDishImageFormat(prefix) : null
    if (!detected || !dishImageFormatMatches(detected, upload.contentType)) {
      await this.rejectPhoto(userId, dishId, upload)
      throw new DishesFailure('rejected', 'Файл не является поддерживаемым изображением блюда')
    }
    const result = await this.dependencies.repository.publishPhoto(userId, dishId, uploadId)
    if (result.replacedObjectKey && result.replacedObjectKey !== upload.objectKey) {
      await this.dependencies.storage.deleteObject(result.replacedObjectKey)
    }
    return result.dish
  }

  private async rejectPhoto(
    userId: string,
    dishId: string,
    upload: { id: string; objectKey: string },
  ) {
    await this.dependencies.repository.discardPhotoUpload(userId, dishId, upload.id)
    await this.dependencies.storage.deleteObject(upload.objectKey)
  }
}
