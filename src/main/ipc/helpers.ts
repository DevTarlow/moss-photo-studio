import { ipcMain } from 'electron'
import type { ZodType } from 'zod'
import type { IpcChannel, IpcRequest, IpcResponse } from '@shared/ipc'
import type { ErrorCode, IpcResult } from '@shared/types'
import { ERROR_MESSAGES } from '@shared/errors'
import { JobStartError } from '../jobs/queue'
import { ImageImportError } from '../media/import'
import { LicenseError } from '../license/controller'
import { requiresActiveLicense } from '../license/policy'
import type { Logger } from '../logger'

export function ok<T>(value: T): IpcResult<T> {
  return { ok: true, data: value }
}

export function fail(code: ErrorCode, message?: string): IpcResult<never> {
  return { ok: false, code, message: message ?? ERROR_MESSAGES[code] }
}

function errorCodeFromFile(error: NodeJS.ErrnoException): ErrorCode | null {
  if (error.code === 'ENOSPC' || error.code === 'EDQUOT') return 'disk_full'
  if (error.code === 'ENOENT') return 'not_found'
  return null
}

export function registerIpc<C extends IpcChannel>(
  context: { logger: Logger; license: { canUseStudio(): Promise<boolean> } },
  channel: C,
  schema: ZodType<IpcRequest<C>>,
  handler: (request: IpcRequest<C>) => Promise<IpcResponse<C>> | IpcResponse<C>
): void {
  ipcMain.handle(channel, async (_event, raw: unknown): Promise<IpcResult<IpcResponse<C>>> => {
    if (requiresActiveLicense(channel) && !(await context.license.canUseStudio())) {
      return fail('unlicensed')
    }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      context.logger.warn('ipc', 'invalid_payload', { area: channel })
      return fail('invalid_payload')
    }
    try {
      return ok(await handler(parsed.data))
    } catch (error) {
      if (error instanceof IpcFault) {
        return fail(error.code, error.message)
      }
      if (error instanceof JobStartError) {
        context.logger.info('ipc', 'job_start_refused', { area: channel, errorCode: error.code })
        return fail(error.code, error.message)
      }
      if (error instanceof LicenseError) {
        context.logger.warn('ipc', 'license_error', { area: channel, errorCode: error.code })
        return fail(error.code)
      }
      if (error instanceof ImageImportError) {
        const codes: Record<string, ErrorCode> = {
          unsupported_type: 'unsupported_type',
          too_large: 'too_large',
          too_small: 'too_small',
          unreadable: 'unreadable',
          disk_full: 'disk_full'
        }
        const code = codes[error.code] ?? 'unreadable'
        return fail(code, error.message)
      }
      if (error instanceof Error && error.message === 'path_outside_library') {
        return fail('invalid_payload')
      }
      if (error instanceof Error) {
        const fileCode = errorCodeFromFile(error as NodeJS.ErrnoException)
        if (fileCode) {
          return fail(fileCode)
        }
      }
      context.logger.error('ipc', 'handler_failed', { area: channel, errorCode: 'unknown' })
      return fail('unknown')
    }
  })
}

export function registerRaw(channel: string, handler: (event: Electron.IpcMainEvent) => void): void {
  ipcMain.on(channel, handler)
}

export class IpcFault extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string
  ) {
    super(message ?? ERROR_MESSAGES[code])
    this.name = 'IpcFault'
  }
}
