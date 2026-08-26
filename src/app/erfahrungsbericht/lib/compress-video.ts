const TARGET_WIDTH = 1280
const TARGET_VIDEO_BITRATE = 2_500_000
const TARGET_AUDIO_BITRATE = 128_000

// Unter dieser Größe lohnt sich kein Re-Encode (selbst aufgenommene Videos
// sind durch die MediaRecorder-Bitrate ohnehin schon zielkonform)
export const COMPRESS_THRESHOLD_BYTES = 30 * 1024 * 1024

export function webCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined'
}

export type VideoCompression = {
  promise: Promise<Blob>
  cancel: () => void
}

/**
 * Transkodiert ein Video clientseitig zu MP4 (H.264, max. 1280px, ~2,5 Mbps).
 * mediabunny wird erst hier dynamisch geladen (nur wer den Video-Step nutzt,
 * lädt die Library). Wirft bei Abbruch oder fehlender Codec-Unterstützung.
 */
export function compressVideo(file: Blob, onProgress: (p: number) => void): VideoCompression {
  let cancelFn: () => void = () => {}

  const promise = (async () => {
    const {
      Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS, canEncodeVideo,
    } = await import('mediabunny')

    if (!(await canEncodeVideo('avc'))) {
      throw new Error('unsupported')
    }

    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
    const target = new BufferTarget()
    const output = new Output({ format: new Mp4OutputFormat(), target })

    // Lange Seite auf 1280 begrenzen, Hochkant-Videos nicht auf 1280 Breite hochskalieren
    const track = await input.getPrimaryVideoTrack()
    const w = track?.displayWidth ?? TARGET_WIDTH
    const h = track?.displayHeight ?? TARGET_WIDTH
    const size = h > w
      ? { height: Math.min(TARGET_WIDTH, h) }
      : { width: Math.min(TARGET_WIDTH, w) }

    const conversion = await Conversion.init({
      input,
      output,
      video: { codec: 'avc', ...size, bitrate: TARGET_VIDEO_BITRATE },
      audio: { codec: 'aac', bitrate: TARGET_AUDIO_BITRATE },
    })

    if (!conversion.isValid) {
      throw new Error('unsupported')
    }

    conversion.onProgress = p => onProgress(Math.min(0.99, p))
    cancelFn = () => { conversion.cancel().catch(() => {}) }

    await conversion.execute()
    onProgress(1)

    const buffer = target.buffer
    if (!buffer) throw new Error('empty')
    return new Blob([buffer], { type: 'video/mp4' })
  })()

  return { promise, cancel: () => cancelFn() }
}
