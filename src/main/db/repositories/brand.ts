import type { Db } from '../connection'
import type { BadgeCorner, BadgeScale, Brand } from '@shared/types'
import { libraryUrl } from '@shared/files'

interface BrandRow {
  id: string
  name: string | null
  sells: string | null
  marketplaces: string | null
  audience: string | null
  voice: string | null
  policies: string | null
  default_platform: string | null
  colors: string | null
  colors_enabled: number
  logo_file: string | null
  badge_enabled: number
  badge_corner: string
  badge_scale: string
  badge_opacity: number
  updated_at: number
}

function parseArray(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const corners: BadgeCorner[] = ['br', 'bl', 'tr', 'tl']
const scales: BadgeScale[] = ['s', 'm', 'l']

export class BrandRepository {
  constructor(private readonly db: Db) {}

  get(): Brand {
    const row = this.db.prepare('SELECT * FROM brand WHERE id = ?').get('default') as BrandRow | undefined
    if (!row) {
      return {
        colors: [],
        colorsEnabled: true,
        logoUrl: null,
        badgeEnabled: false,
        badgeCorner: 'br',
        badgeScale: 'm',
        badgeOpacity: 100,
        businessName: '',
        sells: '',
        audience: '',
        voice: '',
        policies: '',
        marketplaces: [],
        defaultPlatform: 'etsy'
      }
    }
    return {
      colors: parseArray(row.colors).slice(0, 6),
      colorsEnabled: Boolean(row.colors_enabled),
      logoUrl: row.logo_file ? libraryUrl(row.logo_file) : null,
      badgeEnabled: Boolean(row.badge_enabled),
      badgeCorner: corners.includes(row.badge_corner as BadgeCorner) ? (row.badge_corner as BadgeCorner) : 'br',
      badgeScale: scales.includes(row.badge_scale as BadgeScale) ? (row.badge_scale as BadgeScale) : 'm',
      badgeOpacity: Math.max(60, Math.min(100, Number(row.badge_opacity) || 100)),
      businessName: row.name ?? '',
      sells: row.sells ?? '',
      audience: row.audience ?? '',
      voice: row.voice ?? '',
      policies: row.policies ?? '',
      marketplaces: parseArray(row.marketplaces).slice(0, 12),
      defaultPlatform: row.default_platform ?? 'etsy'
    }
  }

  getRow(): BrandRow | null {
    return (this.db.prepare('SELECT * FROM brand WHERE id = ?').get('default') as BrandRow | undefined) ?? null
  }

  update(patch: Partial<Brand>): Brand {
    const current = this.get()
    const next: Brand = {
      ...current,
      ...patch,
      colors: (patch.colors ?? current.colors)
        .filter((color) => /^#[0-9a-fA-F]{6}$/.test(color))
        .slice(0, 6),
      colorsEnabled: patch.colorsEnabled ?? current.colorsEnabled,
      badgeOpacity: Math.max(60, Math.min(100, patch.badgeOpacity ?? current.badgeOpacity)),
      businessName: (patch.businessName ?? current.businessName ?? '').slice(0, 100),
      sells: (patch.sells ?? current.sells ?? '').slice(0, 100),
      audience: (patch.audience ?? current.audience ?? '').slice(0, 200),
      voice: (patch.voice ?? current.voice ?? '').slice(0, 500),
      policies: (patch.policies ?? current.policies ?? '').slice(0, 1000),
      marketplaces: (patch.marketplaces ?? current.marketplaces ?? []).slice(0, 12),
      defaultPlatform: patch.defaultPlatform ?? current.defaultPlatform ?? 'etsy'
    }
    this.db
      .prepare(
        `UPDATE brand SET colors = ?, colors_enabled = ?, badge_enabled = ?, badge_corner = ?, badge_scale = ?,
          badge_opacity = ?, name = ?, sells = ?, marketplaces = ?, audience = ?, voice = ?, policies = ?,
          default_platform = ?, updated_at = ? WHERE id = 'default'`
      )
      .run(
        JSON.stringify(next.colors),
        next.colorsEnabled ? 1 : 0,
        next.badgeEnabled ? 1 : 0,
        next.badgeCorner,
        next.badgeScale,
        next.badgeOpacity,
        next.businessName ?? '',
        next.sells ?? '',
        JSON.stringify(next.marketplaces ?? []),
        next.audience ?? '',
        next.voice ?? '',
        next.policies ?? '',
        next.defaultPlatform ?? 'etsy',
        Date.now()
      )
    return this.get()
  }

  setLogo(file: string | null): Brand {
    this.db.prepare("UPDATE brand SET logo_file = ?, updated_at = ? WHERE id = 'default'").run(file, Date.now())
    return this.get()
  }
}
