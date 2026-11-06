import path from 'node:path'
import { extensionForFormat } from '@shared/shapes'
import type { Format } from '@shared/types'

export function projectDir(projectId: string): string {
  return path.posix.join('projects', projectId)
}

export function originalRelative(projectId: string, imageId: string, format: Format, first: boolean): string {
  const ext = extensionForFormat(format)
  return path.posix.join(projectDir(projectId), first ? `source.${ext}` : `source-${imageId}.${ext}`)
}

export function workingRelative(projectId: string, imageId: string): string {
  return path.posix.join(projectDir(projectId), 'working', `${imageId}.webp`)
}

export function thumbRelative(projectId: string, imageId: string): string {
  return path.posix.join(projectDir(projectId), 'thumbs', `${imageId}.webp`)
}

export function imageRelative(projectId: string, imageId: string, format: Format): string {
  return path.posix.join(projectDir(projectId), 'images', `${imageId}.${extensionForFormat(format)}`)
}

export function exportDirRelative(projectId: string, timestamp = Date.now()): string {
  return path.posix.join(projectDir(projectId), 'exports', String(timestamp))
}

export function absoluteInLibrary(libraryPath: string, relative: string): string {
  const root = path.resolve(libraryPath)
  const resolved = path.resolve(root, relative)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('path_outside_library')
  }
  return resolved
}

export function workingFor(libraryPath: string, projectId: string, imageId: string): string {
  return absoluteInLibrary(libraryPath, workingRelative(projectId, imageId))
}
