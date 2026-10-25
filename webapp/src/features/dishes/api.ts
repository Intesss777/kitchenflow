import {
  createDishPhotoUploadRequestSchema,
  createDishPhotoUploadResponseSchema,
  dishCardResponseSchema,
  dishCardsOverviewResponseSchema,
  saveDishCardRequestSchema,
  type SaveDishCardRequest,
  type CreateDishPhotoUploadRequest,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function getDishCards(
  transport: AuthenticatedTransport,
  options: { signal?: AbortSignal } = {},
) {
  return transport.request('/api/dishes', dishCardsOverviewResponseSchema, options)
}

export function createDishPhotoUpload(
  transport: AuthenticatedTransport,
  dishId: string,
  input: CreateDishPhotoUploadRequest,
) {
  return transport.request(
    `/api/dishes/${encodeURIComponent(dishId)}/photo/uploads`,
    createDishPhotoUploadResponseSchema,
    { method: 'POST', body: createDishPhotoUploadRequestSchema.parse(input) },
  )
}

export function finalizeDishPhotoUpload(
  transport: AuthenticatedTransport,
  dishId: string,
  uploadId: string,
) {
  return transport.request(
    `/api/dishes/${encodeURIComponent(dishId)}/photo/uploads/${encodeURIComponent(uploadId)}/finalize`,
    dishCardResponseSchema,
    { method: 'POST' },
  )
}

export function createDishCard(transport: AuthenticatedTransport, input: SaveDishCardRequest) {
  return transport.request('/api/dishes', dishCardResponseSchema, {
    method: 'POST',
    body: saveDishCardRequestSchema.parse(input),
  })
}

export function updateDishCard(
  transport: AuthenticatedTransport,
  dishId: string,
  input: SaveDishCardRequest,
) {
  return transport.request(`/api/dishes/${encodeURIComponent(dishId)}`, dishCardResponseSchema, {
    method: 'PATCH',
    body: saveDishCardRequestSchema.parse(input),
  })
}
