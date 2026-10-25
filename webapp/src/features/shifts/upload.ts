import {
  SALES_RECEIPT_MAX_BYTES,
  SALES_RECEIPT_MIN_BYTES,
  avatarContentTypeSchema,
  type UploadTicket,
} from '@kitchenflow/contracts'

export class SalesReceiptUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesReceiptUploadError'
  }
}

export function describeSalesReceiptFile(file: File) {
  const declared = avatarContentTypeSchema.safeParse(file.type.toLowerCase())
  let contentType = declared.success ? declared.data : null
  if (!contentType) {
    const extension = file.name.toLowerCase().split('.').pop()
    if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg'
    if (extension === 'png') contentType = 'image/png'
    if (extension === 'heic') contentType = 'image/heic'
    if (extension === 'heif') contentType = 'image/heif'
  }
  if (!contentType) throw new SalesReceiptUploadError('Выберите фотографию JPEG, PNG или HEIC.')
  if (file.size < SALES_RECEIPT_MIN_BYTES) {
    throw new SalesReceiptUploadError('Файл фотографии повреждён или пуст.')
  }
  if (file.size > SALES_RECEIPT_MAX_BYTES) {
    throw new SalesReceiptUploadError('Фотография должна быть меньше 15 МБ.')
  }
  return { contentType, byteSize: file.size }
}

export async function uploadSalesReceiptObject(ticket: UploadTicket, file: File) {
  if (file.size !== ticket.contentLength) {
    throw new SalesReceiptUploadError('Файл изменился во время загрузки. Выберите его ещё раз.')
  }
  let response: Response
  try {
    response = await fetch(ticket.url, {
      method: ticket.method,
      headers: ticket.headers,
      body: file,
      credentials: 'omit',
      mode: 'cors',
    })
  } catch {
    throw new SalesReceiptUploadError('Не удалось отправить фотографию в хранилище.')
  }
  if (!response.ok && response.status !== 412) {
    throw new SalesReceiptUploadError('Хранилище отклонило фотографию. Попробуйте другой файл.')
  }
}
