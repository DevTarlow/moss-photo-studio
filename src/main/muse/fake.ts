import sharp from 'sharp'
import type { Format, Shape } from '@shared/types'
import type { ImageProvider, ValidateResult } from './provider'
import type { MuseFailure, MuseResult } from './client'

const COLORS = ['#3D4A38', '#9A3412', '#14532D', '#5A4A3A', '#2F4858', '#6B4F3A']

function cardSvg(prompt: string, index: number, width: number, height: number): Buffer {
  const stamp = prompt.slice(0, 40).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const words = stamp.match(/.{1,26}(\s|$)/g) ?? [stamp]
  const background = COLORS[index % COLORS.length]!
  const lines = words.slice(0, 3).map(
    (line, i) =>
      `<text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.45 + i * 38)}" font-family="sans-serif" font-size="30" fill="#FAF7F2">${line.trim()}</text>`
  )
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${background}"/>
      <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="#FAF7F2" stroke-opacity="0.28"/>
      <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.16)}" font-family="sans-serif" font-size="20" fill="#FAF7F2" fill-opacity="0.7">MOSS FAKE MUSE</text>
      ${lines.join('')}
      <text x="${Math.round(width * 0.08)}" y="${height - 60}" font-family="sans-serif" font-size="18" fill="#FAF7F2" fill-opacity="0.6">Placeholder render. No request left this computer.</text>
    </svg>`
  )
}

function delay(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), ms)
    const abort = (): void => {
      clearTimeout(timer)
      resolve(false)
    }
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}

async function makeImages(prompt: string, count: number, shape: Shape, format: Format): Promise<Buffer[]> {
  const width = shape === 'landscape' ? 1536 : 1024
  const height = shape === 'portrait' ? 1536 : 1024
  const images: Buffer[] = []
  for (let index = 0; index < count; index += 1) {
    const base = sharp(cardSvg(prompt, index, width, height))
    images.push(
      format === 'jpeg'
        ? await base.jpeg({ quality: 88 }).toBuffer()
        : format === 'png'
          ? await base.png().toBuffer()
          : await base.webp({ quality: 82 }).toBuffer()
    )
  }
  return images
}

export class FakeMuseClient implements ImageProvider {
  async validateKey(key?: string): Promise<ValidateResult> {
    if (!key || !key.trim()) return { ok: false, code: 'invalid_key', status: 401 }
    return { ok: true }
  }

  private async result(
    prompt: string,
    count: number,
    shape: Shape,
    format: Format,
    signal?: AbortSignal
  ): Promise<MuseResult> {
    const waited = await delay(1500, signal)
    if (!waited) {
      const failure: MuseFailure = {
        ok: false,
        code: 'aborted',
        status: 0,
        requestId: crypto.randomUUID()
      }
      return failure
    }
    return {
      ok: true,
      images: await makeImages(prompt, count, shape, format),
      returnedCount: count,
      outputFormat: format,
      revisedPrompts: new Array(count).fill(null),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      requestId: crypto.randomUUID(),
      status: 200
    }
  }

  async generate(input: {
    prompt: string
    count: number
    shape: Shape
    format: Format
    signal?: AbortSignal
  }): Promise<MuseResult> {
    return this.result(input.prompt, input.count, input.shape, input.format, input.signal)
  }

  async edit(input: {
    prompt: string
    images: Buffer[]
    shape: Shape
    format: Format
    signal?: AbortSignal
  }): Promise<MuseResult> {
    return this.result(input.prompt, 1, input.shape, input.format, input.signal)
  }
}
