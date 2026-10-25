import type {
  CreateInvoiceUploadRequest,
  CreateInvoiceUploadResponse,
  PurchaseInvoice,
  PurchaseInvoiceListQuery,
  PurchaseInvoiceResponse,
  UpdatePurchaseInvoiceRequest,
} from '@kitchenflow/contracts'

import { InvoicesFailure } from '../domain/errors'
import {
  detectInvoiceImageFormat,
  invoiceImageFormatMatches,
  invoiceImageSignatureByteLength,
} from '../domain/image-format'
import type {
  InvoiceObjectKeyFactory,
  InvoicesRepository,
  PrivateStorage,
} from './ports'

export class InvoicesService {
  constructor(
    private readonly dependencies: {
      clock: { now(): Date }
      objectKeys: InvoiceObjectKeyFactory
      repository: InvoicesRepository
      storage: PrivateStorage
    },
  ) {}

  async createUpload(
    userId: string,
    input: CreateInvoiceUploadRequest,
  ): Promise<CreateInvoiceUploadResponse> {
    const now = this.dependencies.clock.now()
    const objectKey = this.dependencies.objectKeys.create(now)
    const upload = await this.dependencies.storage.createUploadUrl({
      key: objectKey,
      contentType: input.contentType,
      byteSize: input.byteSize,
    })
    const invoiceId = await this.dependencies.repository.createPending({
      userId,
      objectKey,
      contentType: input.contentType,
      byteSize: input.byteSize,
      uploadExpiresAt: new Date(upload.expiresAt),
    })
    return {
      upload: {
        uploadId: invoiceId,
        method: upload.method,
        url: upload.url,
        headers: upload.headers,
        contentLength: upload.contentLength,
        expiresAt: upload.expiresAt,
      },
    }
  }

  async finalize(userId: string, invoiceId: string): Promise<PurchaseInvoiceResponse> {
    const upload = await this.dependencies.repository.findUpload(userId, invoiceId)
    if (!upload) throw new InvoicesFailure('not_found', 'Invoice upload not found')
    if (upload.status !== 'upload_pending') {
      return { invoice: await this.withImage(userId, await this.dependencies.repository.read(userId, invoiceId)) }
    }
    if (upload.uploadExpiresAt <= this.dependencies.clock.now()) {
      await this.dependencies.repository.markRejected(userId, invoiceId)
      throw new InvoicesFailure('expired', 'Invoice upload window has expired')
    }
    const stored = await this.dependencies.storage.headObject(upload.objectKey)
    if (!stored) throw new InvoicesFailure('upload_incomplete', 'Invoice photo has not finished uploading')
    if (stored.contentLength !== upload.byteSize) {
      await this.rejectUpload(userId, upload)
      throw new InvoicesFailure('rejected', 'Invoice photo size does not match the upload')
    }
    const prefix = await this.dependencies.storage.readRange(upload.objectKey, {
      start: 0,
      end: invoiceImageSignatureByteLength - 1,
    })
    const detected = prefix ? detectInvoiceImageFormat(prefix) : null
    if (!detected || !invoiceImageFormatMatches(detected, upload.contentType)) {
      await this.rejectUpload(userId, upload)
      throw new InvoicesFailure('rejected', 'Uploaded file is not a supported invoice image')
    }
    const invoice = await this.dependencies.repository.recognize(
      userId,
      invoiceId,
      this.dependencies.clock.now(),
    )
    return { invoice: await this.withImage(userId, invoice) }
  }

  list(userId: string, query: PurchaseInvoiceListQuery) {
    return this.dependencies.repository.list(userId, query, this.dependencies.clock.now())
  }

  async invoice(userId: string, invoiceId: string): Promise<PurchaseInvoiceResponse> {
    return {
      invoice: await this.withImage(userId, await this.dependencies.repository.read(userId, invoiceId)),
    }
  }

  async update(
    userId: string,
    invoiceId: string,
    input: UpdatePurchaseInvoiceRequest,
  ): Promise<PurchaseInvoiceResponse> {
    return {
      invoice: await this.withImage(userId,
        await this.dependencies.repository.update(userId, invoiceId, input),
      ),
    }
  }

  async confirm(userId: string, invoiceId: string): Promise<PurchaseInvoiceResponse> {
    return {
      invoice: await this.withImage(userId,
        await this.dependencies.repository.confirm(
          userId,
          invoiceId,
          this.dependencies.clock.now(),
        ),
      ),
    }
  }

  private async withImage(userId: string, invoice: PurchaseInvoice): Promise<PurchaseInvoice> {
    const upload = await this.dependencies.repository.findUpload(userId, invoice.id)
    if (!upload) return invoice
    const download = await this.dependencies.storage.createDownloadUrl({ key: upload.objectKey })
    return { ...invoice, imageUrl: download.url }
  }

  private async rejectUpload(userId: string, upload: { id: string; objectKey: string }) {
    await this.dependencies.repository.markRejected(userId, upload.id)
    await this.dependencies.storage.deleteObject(upload.objectKey)
  }
}
