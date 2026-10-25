import type { AvatarContentType } from '@kitchenflow/contracts'

export const invoiceImageSignatureByteLength = 12

const heifBrands = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'])

export function detectInvoiceImageFormat(bytes: Uint8Array): AvatarContentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (bytes.length >= invoiceImageSignatureByteLength && asciiAt(bytes, 4, 4) === 'ftyp') {
    return heifBrands.has(asciiAt(bytes, 8, 4)) ? 'image/heic' : null
  }
  return null
}

export function invoiceImageFormatMatches(
  detected: AvatarContentType,
  declared: AvatarContentType,
) {
  return normalize(detected) === normalize(declared)
}

function normalize(contentType: AvatarContentType) {
  return contentType === 'image/heif' ? 'image/heic' : contentType
}

function asciiAt(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}
