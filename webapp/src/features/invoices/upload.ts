import {
  INVOICE_MAX_BYTES,
  INVOICE_MIN_BYTES,
  invoiceContentTypeSchema,
  type UploadTicket,
} from '@kitchenflow/contracts'

export class InvoiceUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvoiceUploadError'
  }
}

export function describeInvoiceFile(file: File) {
  const declared = invoiceContentTypeSchema.safeParse(file.type.toLowerCase())
  let contentType = declared.success ? declared.data : null
  if (!contentType) {
    const extension = file.name.toLowerCase().split('.').pop()
    if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg'
    if (extension === 'png') contentType = 'image/png'
    if (extension === 'heic') contentType = 'image/heic'
    if (extension === 'heif') contentType = 'image/heif'
  }
  if (!contentType) throw new InvoiceUploadError('Выберите фотографию JPEG, PNG или HEIC.')
  if (file.size < INVOICE_MIN_BYTES) throw new InvoiceUploadError('Файл фотографии повреждён или пуст.')
  if (file.size > INVOICE_MAX_BYTES) throw new InvoiceUploadError('Фотография должна быть меньше 15 МБ.')
  return { contentType, byteSize: file.size }
}

export async function uploadInvoiceObject(ticket: UploadTicket, file: File) {
  if (file.size !== ticket.contentLength) {
    throw new InvoiceUploadError('Файл изменился во время загрузки. Выберите его ещё раз.')
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
    throw new InvoiceUploadError('Не удалось отправить фотографию в хранилище.')
  }
  if (!response.ok && response.status !== 412) {
    throw new InvoiceUploadError('Хранилище отклонило фотографию. Попробуйте другой файл.')
  }
}
