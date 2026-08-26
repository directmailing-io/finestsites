import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!

export async function uploadToR2(key: string, body: Buffer | string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  })
  await r2Client.send(command)
  return key
}

export async function getFromR2(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  const response = await r2Client.send(command)
  const body = await response.Body?.transformToString()
  return body || ''
}

export async function getRawFromR2(key: string): Promise<{ data: Buffer; contentType: string | undefined }> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  const response = await r2Client.send(command)
  const bytes = await response.Body?.transformToByteArray()
  return {
    data: Buffer.from(bytes ?? []),
    contentType: response.ContentType,
  }
}

export async function deleteFromR2(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  await r2Client.send(command)
}

export async function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(r2Client, command, { expiresIn })
}

export async function getPresignedDownloadUrl(key: string, expiresIn = 900, downloadFilename?: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(downloadFilename
      ? { ResponseContentDisposition: `attachment; filename="${downloadFilename.replace(/[^\w.\- ]/g, '_')}"` }
      : {}),
  })
  return getSignedUrl(r2Client, command, { expiresIn })
}

export async function getRangeFromR2(key: string, start: number, end: number): Promise<{ data: Buffer; totalSize: number | undefined }> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Range: `bytes=${start}-${end}`,
  })
  const response = await r2Client.send(command)
  const bytes = await response.Body?.transformToByteArray()
  // ContentRange: "bytes 0-63/12345678" — hinterer Teil ist die Gesamtgröße
  const totalSize = response.ContentRange
    ? parseInt(response.ContentRange.split('/')[1], 10) || undefined
    : undefined
  return { data: Buffer.from(bytes ?? []), totalSize }
}

export async function getStreamFromR2(key: string): Promise<NodeJS.ReadableStream | null> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  const response = await r2Client.send(command)
  return (response.Body as NodeJS.ReadableStream | undefined) ?? null
}
