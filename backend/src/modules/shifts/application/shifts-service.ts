import type {
  CreateSalesReceiptUploadRequest,
  CreateSalesReceiptUploadResponse,
  SalesShift,
  UpdateSalesShiftRequest,
} from '@kitchenflow/contracts'

import { ShiftsFailure } from '../domain/errors'
import {
  detectSalesReceiptImageFormat,
  salesReceiptImageFormatMatches,
  salesReceiptImageSignatureByteLength,
} from '../domain/image-format'
import type {
  PrivateStorage,
  SalesReceiptObjectKeyFactory,
  ShiftsRepository,
} from './ports'

export class ShiftsService {
  constructor(private readonly dependencies: {
    clock: { now(): Date }
    objectKeys: SalesReceiptObjectKeyFactory
    repository: ShiftsRepository
    storage: PrivateStorage
  }) {}

  async createUpload(
    userId: string,
    input: CreateSalesReceiptUploadRequest,
  ): Promise<CreateSalesReceiptUploadResponse> {
    const now = this.dependencies.clock.now()
    const objectKey = this.dependencies.objectKeys.create(now)
    const upload = await this.dependencies.storage.createUploadUrl({
      key: objectKey,
      contentType: input.contentType,
      byteSize: input.byteSize,
    })
    const pending = await this.dependencies.repository.createPending({
      userId,
      shiftDate: input.shiftDate,
      objectKey,
      contentType: input.contentType,
      byteSize: input.byteSize,
      uploadExpiresAt: new Date(upload.expiresAt),
    })
    return {
      shiftId: pending.shiftId,
      upload: {
        uploadId: pending.receiptId,
        method: upload.method,
        url: upload.url,
        headers: upload.headers,
        contentLength: upload.contentLength,
        expiresAt: upload.expiresAt,
      },
    }
  }

  async finalize(userId: string, receiptId: string) {
    const upload = await this.dependencies.repository.findUpload(userId, receiptId)
    if (!upload) throw new ShiftsFailure('not_found', 'Загрузка чека не найдена')
    if (upload.status !== 'upload_pending') {
      return { shift: await this.withReceiptImages(userId, await this.dependencies.repository.read(userId, upload.shiftId)) }
    }
    if (upload.uploadExpiresAt <= this.dependencies.clock.now()) {
      await this.dependencies.repository.markRejected(userId, receiptId)
      throw new ShiftsFailure('expired', 'Время загрузки чека истекло. Выберите файл ещё раз')
    }
    const stored = await this.dependencies.storage.headObject(upload.objectKey)
    if (!stored) throw new ShiftsFailure('upload_incomplete', 'Фото чека ещё не загрузилось')
    if (stored.contentLength !== upload.byteSize) {
      await this.rejectUpload(userId, upload)
      throw new ShiftsFailure('rejected', 'Размер загруженного фото чека не совпадает с выбранным файлом')
    }
    const prefix = await this.dependencies.storage.readRange(upload.objectKey, {
      start: 0,
      end: salesReceiptImageSignatureByteLength - 1,
    })
    const detected = prefix ? detectSalesReceiptImageFormat(prefix) : null
    if (!detected || !salesReceiptImageFormatMatches(detected, upload.contentType)) {
      await this.rejectUpload(userId, upload)
      throw new ShiftsFailure('rejected', 'Файл не является поддерживаемым изображением чека')
    }
    const shiftId = await this.dependencies.repository.recognize(
      userId,
      receiptId,
      this.dependencies.clock.now(),
    )
    return { shift: await this.withReceiptImages(userId, await this.dependencies.repository.read(userId, shiftId)) }
  }

  list(userId: string) {
    return this.dependencies.repository.list(userId, this.dependencies.clock.now())
  }

  async shift(userId: string, shiftId: string) {
    return { shift: await this.withReceiptImages(userId, await this.dependencies.repository.read(userId, shiftId)) }
  }

  async update(userId: string, shiftId: string, input: UpdateSalesShiftRequest) {
    return { shift: await this.withReceiptImages(userId, await this.dependencies.repository.update(userId, shiftId, input)) }
  }

  async confirm(userId: string, shiftId: string) {
    return { shift: await this.withReceiptImages(userId, await this.dependencies.repository.confirm(userId, shiftId, this.dependencies.clock.now())) }
  }

  private async withReceiptImages(userId: string, shift: SalesShift): Promise<SalesShift> {
    const objects = await this.dependencies.repository.receiptObjects(userId, shift.id)
    const urls = new Map<string, string>()
    await Promise.all(objects.map(async (object) => {
      const download = await this.dependencies.storage.createDownloadUrl({ key: object.objectKey })
      urls.set(object.id, download.url)
    }))
    return {
      ...shift,
      receipts: shift.receipts.map((receipt) => ({
        ...receipt,
        imageUrl: urls.get(receipt.id) ?? null,
      })),
    }
  }

  private async rejectUpload(userId: string, upload: { id: string; objectKey: string }) {
    await this.dependencies.repository.markRejected(userId, upload.id)
    await this.dependencies.storage.deleteObject(upload.objectKey)
  }
}
