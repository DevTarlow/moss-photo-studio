import fs from 'node:fs'
import path from 'node:path'

type LogLevel = 'info' | 'warn' | 'error'

export interface LogFields {
  requestId?: string
  status?: number
  durationMs?: number
  count?: number
  errorCode?: string
  area?: string
  [key: string]: unknown
}

const MAX_BYTES = 2 * 1024 * 1024
const BLOCKED_KEYS = new Set([
  'authorization',
  'key',
  'museKey',
  'licenseKey',
  'license_key',
  'prompt',
  'body',
  'image',
  'bytes',
  'path',
  'file',
  'thumb'
])

const KEY_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /LLM\|[A-Za-z0-9._~+/=-]+/g,
  /sk-[A-Za-z0-9_-]{8,}/g,
  /license[_-]?key["'\s:=]+[A-Za-z0-9-]{8,}/gi
]

export function redactText(value: string): string {
  let text = value
  for (const pattern of KEY_PATTERNS) text = text.replace(pattern, '[redacted]')
  return text
}

function sanitiseFields(fields: LogFields): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (BLOCKED_KEYS.has(key)) continue
    if (typeof value === 'string') out[key] = redactText(value).slice(0, 2000)
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[key] = value
    else if (Array.isArray(value)) out[key] = value.slice(0, 20).map((item) => String(item).slice(0, 200))
  }
  return out
}

export class Logger {
  private readonly file: string
  private readonly previous: string
  private ready = false

  constructor(logDir: string) {
    fs.mkdirSync(logDir, { recursive: true, mode: 0o700 })
    this.file = path.join(logDir, 'main.log')
    this.previous = path.join(logDir, 'main.1.log')
  }

  private ensureWritable(): void {
    if (this.ready) return
    this.ready = true
    try {
      const stat = fs.statSync(this.file)
      if (stat.size > MAX_BYTES) {
        fs.rmSync(this.previous, { force: true })
        fs.renameSync(this.file, this.previous)
      }
    } catch {
      // A missing log file is normal on first run.
    }
  }

  private write(level: LogLevel, area: string, message: string, fields: LogFields = {}): void {
    this.ensureWritable()
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      area,
      message: redactText(message),
      ...sanitiseFields(fields)
    })
    try {
      fs.appendFileSync(this.file, `${line}\n`, { mode: 0o600 })
      const stat = fs.statSync(this.file)
      if (stat.size > MAX_BYTES) {
        fs.rmSync(this.previous, { force: true })
        fs.renameSync(this.file, this.previous)
      }
    } catch {
      // Logging must never take the app down.
    }
  }

  info(area: string, message: string, fields?: LogFields): void {
    this.write('info', area, message, fields)
  }

  warn(area: string, message: string, fields?: LogFields): void {
    this.write('warn', area, message, fields)
  }

  error(area: string, message: string, fields?: LogFields): void {
    this.write('error', area, message, fields)
  }

  openFolder(): string {
    return path.dirname(this.file)
  }
}
