import { unzipSync } from 'fflate'
import { uploadToR2 } from './client'

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4',
  webm: 'video/webm',
  xml: 'application/xml',
  txt: 'text/plain',
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

/** Strips a single top-level directory prefix from path if all files share it */
function stripTopLevelDir(files: string[]): (path: string) => string {
  if (files.length === 0) return (p) => p
  const firstPart = files[0].split('/')[0]
  const allShared = files.every(f => f.startsWith(firstPart + '/'))
  if (allShared && files.length > 1) {
    const prefix = firstPart + '/'
    return (p) => p.startsWith(prefix) ? p.slice(prefix.length) : p
  }
  return (p) => p
}

export interface ZipUploadResult {
  indexPath: string
  fileCount: number
  files: string[]
}

export async function processZipUpload(
  buffer: Buffer,
  templateId: string
): Promise<ZipUploadResult> {
  let unzipped: ReturnType<typeof unzipSync>
  try {
    unzipped = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error('Ungültige ZIP-Datei.')
  }

  const allPaths = Object.keys(unzipped).filter(p => !p.endsWith('/'))
  if (allPaths.length === 0) throw new Error('ZIP-Datei ist leer.')

  const normalize = stripTopLevelDir(allPaths)

  const uploads: Promise<void>[] = []
  const uploadedFiles: string[] = []

  for (const [rawPath, content] of Object.entries(unzipped)) {
    if (rawPath.endsWith('/')) continue // directory entry
    const normalized = normalize(rawPath).replace(/^\/+/, '')
    if (!normalized) continue

    const key = `templates/${templateId}/${normalized}`
    const fileBuffer = Buffer.from(content)
    const contentType = getContentType(normalized)

    uploadedFiles.push(normalized)
    uploads.push(uploadToR2(key, fileBuffer, contentType).then(() => undefined))
  }

  await Promise.all(uploads)

  const hasIndex = uploadedFiles.includes('index.html')
  if (!hasIndex) {
    throw new Error('ZIP-Datei muss eine index.html im Stammverzeichnis enthalten.')
  }

  return {
    indexPath: `templates/${templateId}/index.html`,
    fileCount: uploadedFiles.length,
    files: uploadedFiles,
  }
}
