import {
  DISH_PHOTO_MAX_BYTES,
  DISH_PHOTO_MIN_BYTES,
  avatarContentTypeSchema,
  type UploadTicket,
} from '@kitchenflow/contracts'

export class DishPhotoUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DishPhotoUploadError'
  }
}

export function describeDishPhoto(file: File) {
  const declared = avatarContentTypeSchema.safeParse(file.type.toLowerCase())
  let contentType = declared.success ? declared.data : null
  if (!contentType) {
    const extension = file.name.toLowerCase().split('.').pop()
    if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg'
    if (extension === 'png') contentType = 'image/png'
    if (extension === 'heic') contentType = 'image/heic'
    if (extension === 'heif') contentType = 'image/heif'
  }
  if (!contentType) throw new DishPhotoUploadError('Выберите фотографию JPEG, PNG или HEIC.')
  if (file.size < DISH_PHOTO_MIN_BYTES) throw new DishPhotoUploadError('Файл фотографии повреждён или пуст.')
  if (file.size > DISH_PHOTO_MAX_BYTES) throw new DishPhotoUploadError('Фотография должна быть меньше 10 МБ.')
  return { contentType, byteSize: file.size }
}

export async function uploadDishPhotoObject(ticket: UploadTicket, file: File) {
  if (file.size !== ticket.contentLength) {
    throw new DishPhotoUploadError('Файл изменился во время загрузки. Выберите его ещё раз.')
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
    throw new DishPhotoUploadError('Не удалось отправить фотографию в хранилище.')
  }
  if (!response.ok && response.status !== 412) {
    throw new DishPhotoUploadError('Хранилище отклонило фотографию. Попробуйте другой файл.')
  }
}
