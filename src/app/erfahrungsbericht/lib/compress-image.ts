const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.82

/**
 * Verkleinert ein Foto clientseitig auf max. 2000px Kantenlänge (JPEG).
 * Gibt null zurück, wenn das Bild nicht dekodiert werden kann — dann
 * entscheidet der Aufrufer, ob das Original klein genug für den Upload ist.
 */
export async function compressImage(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, width, height)

    return await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), 'image/jpeg', JPEG_QUALITY)
    )
  } finally {
    bitmap.close()
  }
}
