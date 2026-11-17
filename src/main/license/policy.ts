import type { IpcChannel } from '@shared/ipc'

/**
 * Channels that create or change studio content. Reads, exports, copies,
 * deletes, settings, license management, backups, and diagnostics stay open so
 * a lapsed license never hides or traps the seller's own work.
 *
 * Keep this list as the single source of truth. The main-process guard in
 * registerIpc is authoritative; a renderer control that is missed only shows
 * the normal "reactivate" message instead of doing the work.
 */
export const LICENSE_REQUIRED_CHANNELS: ReadonlySet<IpcChannel> = new Set([
  'projects:create',
  'projects:createFromImage',
  'projects:update',
  'projects:duplicate',
  'dialog:importImage',
  'media:importBytes',
  'media:importFromImage',
  'jobs:startCreate',
  'jobs:startEdit',
  'jobs:retryFailed',
  'adjust:apply',
  'adjust:applyBatch',
  'adjust:sizeLabel',
  'images:setCover',
  'images:setSource',
  'images:assignSet',
  'sets:create',
  'sets:rename',
  'products:createFromProject',
  'products:createFromImage',
  'products:createFromBytes',
  'products:createProject',
  'products:importIntoProject',
  'products:linkProject',
  'products:unlinkProject',
  'products:update',
  'products:archive',
  'products:unarchive',
  'products:rename',
  'products:assignSet',
  'dialog:pickProduct',
  'people:create',
  'people:createFromImage',
  'people:createImageProject',
  'people:rename'
] satisfies IpcChannel[])

export function requiresActiveLicense(channel: IpcChannel): boolean {
  return LICENSE_REQUIRED_CHANNELS.has(channel)
}
