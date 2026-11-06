import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { protocol } from 'electron'

export const MEDIA_SCHEME = 'moss-media'

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false
      }
    }
  ])
}

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
}

function bundledAllowlist(resourceRoot: string): Set<string> {
  const allowed = new Set<string>()
  const walk = (dir: string, prefix = ''): void => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relative)
      else allowed.add(relative)
    }
  }
  walk(resourceRoot)
  return allowed
}

export function installMediaProtocol(options: {
  resourceRoot: () => string
  libraryPath: () => string
}): void {
  let cache: { root: string; allowed: Set<string> } | null = null
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      const host = url.hostname
      let relative: string
      try {
        relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      } catch {
        return new Response('Bad request', { status: 400 })
      }
      if (!relative || relative.includes('\0')) return new Response('Not found', { status: 404 })
      let root: string
      if (host === 'bundled') {
        root = options.resourceRoot()
        if (!cache || cache.root !== root) {
          cache = { root, allowed: bundledAllowlist(root) }
        }
        if (!cache.allowed.has(relative)) return new Response('Not found', { status: 404 })
      } else if (host === 'library') {
        root = options.libraryPath()
      } else {
        return new Response('Not found', { status: 404 })
      }
      const resolved = path.resolve(root, relative)
      if (resolved !== path.resolve(root) && !resolved.startsWith(`${path.resolve(root)}${path.sep}`)) {
        return new Response('Not found', { status: 404 })
      }
      const buffer = await fsp.readFile(resolved)
      const ext = path.extname(resolved).toLowerCase()
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
          'Cache-Control': 'private, max-age=3600'
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
