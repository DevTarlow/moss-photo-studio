import type { Format, Shape } from '@shared/types'
import type { MuseFailure, MuseResult, MuseSuccess } from './client'

export type ValidateResult = { ok: true } | { ok: false; code: import('@shared/types').ErrorCode; status: number }

export interface ImageProvider {
  validateKey(key?: string): Promise<ValidateResult>
  generate(input: {
    prompt: string
    count: number
    shape: Shape
    format: Format
    signal?: AbortSignal
    onRateLimitWait?: (waitMs: number) => void
  }): Promise<MuseResult>
  edit(input: {
    prompt: string
    images: Buffer[]
    shape: Shape
    format: Format
    signal?: AbortSignal
    onRateLimitWait?: (waitMs: number) => void
  }): Promise<MuseResult>
}

export type { MuseResult, MuseFailure, MuseSuccess }
