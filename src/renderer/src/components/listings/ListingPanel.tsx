import { useEffect, useState } from 'react'
import { Copy, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import type { ListingCopy, ListingPlatform } from '@shared/listings'
import { LISTING_PLATFORMS, limitsFor } from '@shared/listings'
import { LISTING_COST_LABEL } from '@shared/cost'
import { Button } from '../ui/Button'
import { TextArea, TextInput } from '@astryxdesign/core'
import { useAppStore } from '../../store/app'
import { unwrap, messageOf } from '../../lib/ipc'
import { formatDateTime } from '../../lib/format'
import { toast } from '../../lib/toast'

function microsLabel(micros: number): string {
  if (micros <= 0) return LISTING_COST_LABEL
  return `$${(micros / 1_000_000).toFixed(4)}`
}

export function ListingPanel({
  productId,
  productName,
  projectId
}: {
  productId: string
  productName: string
  projectId: string | null
}): React.JSX.Element {
  const brand = useAppStore((state) => state.brand)
  const secrets = useAppStore((state) => state.secrets)
  const defaultPlatform: ListingPlatform =
    brand?.defaultPlatform === 'shopify' ? 'shopify' : brand?.defaultPlatform === 'own' || brand?.defaultPlatform === 'other' ? 'own' : 'etsy'
  const [platform, setPlatform] = useState<ListingPlatform>(defaultPlatform)
  const [listing, setListing] = useState<ListingCopy | null>(null)
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [useProfile, setUseProfile] = useState(true)
  const [form, setForm] = useState({
    titles: ['', '', ''],
    description: '',
    features: ['', '', '', '', ''],
    tags: ''
  })
  const limits = limitsFor(platform)

  const apply = (copy: ListingCopy): void => {
    setListing(copy)
    setForm({
      titles: [...copy.titles, '', '', ''].slice(0, limits.titleOptions),
      description: copy.description,
      features: [...copy.features, '', '', '', '', ''].slice(0, limits.featureCount),
      tags: copy.tags.join(', ')
    })
  }

  const load = async (next = platform): Promise<void> => {
    setLoading(true)
    try {
      const found = await unwrap(window.moss.listings.get({ productId, platform: next }))
      if (found) {
        setVersion(found.version)
        apply(found.copy)
      } else {
        setListing(null)
        setVersion(0)
        setForm({ titles: ['', '', ''], description: '', features: ['', '', '', '', ''], tags: '' })
      }
    } catch {
      setListing(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(platform)
  }, [productId, platform])

  const generate = async (): Promise<void> => {
    if (!secrets?.hasKey) {
      toast.error('Add your Muse key in Settings before writing a listing.')
      return
    }
    setGenerating(true)
    try {
      const result = await unwrap(
        window.moss.listings.generate({ productId, platform, projectId, useProfile })
      )
      setVersion(result.version)
      apply(result.copy)
      toast.status('Listing copy written.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setGenerating(false)
    }
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const result = await unwrap(
        window.moss.listings.save({
          productId,
          platform,
          copy: {
            titles: form.titles.map((title) => title.trim()).filter(Boolean),
            description: form.description,
            features: form.features.map((feature) => feature.trim()).filter(Boolean),
            tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
            altTexts: listing?.altTexts ?? [],
            costMicros: listing?.costMicros ?? 0
          }
        })
      )
      setVersion(result.version)
      apply(result.copy)
      toast.status('Listing saved.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setSaving(false)
    }
  }

  const copy = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      toast.status(`${label} copied.`)
    } catch {
      toast.error('That could not be copied.')
    }
  }

  const allText = listing
    ? [form.titles.filter(Boolean).join('\n'), form.description, form.features.filter(Boolean).join('\n'), form.tags].join('\n\n')
    : ''

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="section-label">Listing copy</p>
          <p className="hint mt-1">Titles, description, features and tags, written from the product photo and your shop profile.</p>
        </div>
        <select
          className="field w-auto"
          aria-label="Listing platform"
          value={platform}
          disabled={generating || saving}
          onChange={(event) => setPlatform(event.target.value as ListingPlatform)}
        >
          {LISTING_PLATFORMS.map((entry) => (
            <option key={entry.platform} value={entry.platform}>{entry.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={14} className="animate-spin" /> Checking for a saved listing...
        </p>
      ) : !listing ? (
        <div className="mt-4 rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[12px]">No listing copy for {productName} on {limits.label} yet.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={generating || !secrets?.hasKey} onClick={() => void generate()}>
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Write listing · {LISTING_COST_LABEL}
            </Button>
            {!secrets?.hasKey && <span className="hint">Add your Muse key in Settings first.</span>}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">Version {version}</span>
            <span className="meta">Saved {formatDateTime(listing.createdAt)}</span>
            <span className="meta">· {microsLabel(listing.costMicros)} of text</span>
            <label className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={useProfile} onChange={(event) => setUseProfile(event.target.checked)} /> Use my Business profile
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            {form.titles.slice(0, limits.titleOptions).map((title, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <TextInput
                    label={`Title ${index + 1}`}
                    value={title}
                    onChange={(next) => setForm({ ...form, titles: form.titles.map((value, at) => (at === index ? next : value)) })}
                    description={`${title.length} / ${limits.titleMax}`}
                    width="100%"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => void copy(title, `Title ${index + 1}`)} aria-label={`Copy title ${index + 1}`}>
                  <Copy size={14} />
                </Button>
              </div>
            ))}
            <div>
              <TextArea
                label="Description"
                value={form.description}
                onChange={(next) => setForm({ ...form, description: next })}
                description={`${form.description.length} / ${limits.descriptionMax}`}
                rows={6}
                width="100%"
              />
              <div className="mt-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => void copy(form.description, 'Description')}>Copy description</Button>
              </div>
            </div>
            {form.features.slice(0, limits.featureCount).map((feature, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <TextInput
                    label={`Feature ${index + 1}`}
                    value={feature}
                    onChange={(next) => setForm({ ...form, features: form.features.map((value, at) => (at === index ? next : value)) })}
                    description={`${feature.length} / ${limits.featureMax}`}
                    width="100%"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => void copy(feature, `Feature ${index + 1}`)} aria-label={`Copy feature ${index + 1}`}>
                  <Copy size={14} />
                </Button>
              </div>
            ))}
            {limits.tagCount > 0 && (
              <TextInput
                label="Tags"
                value={form.tags}
                onChange={(next) => setForm({ ...form, tags: next })}
                description={`Comma separated, up to ${limits.tagCount} tags of ${limits.tagMax} characters.`}
                width="100%"
              />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Listing
            </Button>
            <Button variant="secondary" disabled={generating} onClick={() => void generate()}>
              {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Write Again · {LISTING_COST_LABEL}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void copy(allText, 'Listing')}>Copy All</Button>
            <span className="hint ml-auto">{limits.label} limits checked {limits.asOf}.</span>
          </div>
          {listing.altTexts.length > 0 && (
            <div className="mt-3 rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between gap-2">
                <p className="field-label">Image alt text</p>
                <Button variant="ghost" size="sm" onClick={() => void copy(listing.altTexts.join('\n'), 'Alt text')}>Copy all</Button>
              </div>
              <ul className="mt-1 grid gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {listing.altTexts.map((text, index) => <li key={index}>{text}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
