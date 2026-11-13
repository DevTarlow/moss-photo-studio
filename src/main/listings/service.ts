import fs from 'node:fs/promises'
import type { PlanJson } from '@shared/types'
import type { ListingCopy, ListingLimits } from '@shared/listings'
import { clampListingCopy, limitsFor } from '@shared/listings'
import type { BrandRepository } from '../db/repositories/brand'
import type { ImageRepository } from '../db/repositories/images'
import type { ListingRepository } from '../db/repositories/listings'
import type { PlanRepository } from '../db/repositories/plans'
import type { ProductRepository } from '../db/repositories/products'
import type { ProjectRepository } from '../db/repositories/projects'
import type { UsageRepository } from '../db/repositories/usage'
import type { Logger } from '../logger'
import type { TextProvider } from '../muse/text'
import { absoluteInLibrary } from '../media/paths'
import { shotDefinition } from '@shared/prompts/shots'
import { isBundledProduct } from '@shared/products'
import { extractJsonObject } from '@shared/aiJson'
import { ListingError } from './error'

interface ListingFacts {
  product: string
  category: string
  audience: string
  notes: string
  shots: Array<{ label: string; direction: string }>
  profile: {
    businessName: string
    sells: string
    audience: string
    voice: string
    policies: string
    marketplaces: string[]
  }
}

function altFor(product: string, label: string, direction: string): string {
  return `${product}: ${label}. ${direction}`.slice(0, 250)
}

function promptFor(facts: ListingFacts, limits: ListingLimits): { system: string; user: string } {
  const system = [
    'You write product listings for a small shop.',
    'Use only the facts given and the attached product photo. Never invent a material, dimension, certification, origin, shipping time, or claim that is not in the facts.',
    'Write in the shop voice when one is given. Keep the language plain and specific, with regular hyphens and no em dashes.',
    'Answer with JSON only, no prose and no code fence, in exactly this shape:',
    '{"titles": [string], "description": string, "features": [string], "tags": [string]}',
    `Write exactly ${limits.titleOptions} titles, ${limits.featureCount} short features, and ${limits.tagCount || 0} tags.`,
    `Titles max ${limits.titleMax} characters. Description max ${limits.descriptionMax} characters. Features max ${limits.featureMax} characters. Tags max ${limits.tagMax} characters.`,
    'Do not put the tags in the description. Do not use markdown.'
  ].join(' ')
  const lines = [
    `Product: ${facts.product}`,
    facts.category ? `What it is: ${facts.category}` : '',
    facts.audience ? `Who buys it: ${facts.audience}` : '',
    facts.notes ? `Details from the seller: ${facts.notes}` : '',
    facts.profile.businessName ? `Shop: ${facts.profile.businessName}` : '',
    facts.profile.sells ? `The shop sells: ${facts.profile.sells}` : '',
    facts.profile.audience ? `The shop's audience: ${facts.profile.audience}` : '',
    facts.profile.voice ? `How the shop writes: ${facts.profile.voice}` : '',
    facts.profile.policies ? `Standard answers: ${facts.profile.policies}` : '',
    facts.profile.marketplaces.length ? `Where they sell: ${facts.profile.marketplaces.join(', ')}` : '',
    facts.shots.length
      ? `The listing images show: ${facts.shots.map((shot) => `${shot.label} (${shot.direction})`).join('; ')}`
      : '',
    `Platform: ${limits.label}. Return the listing in JSON only.`
  ].filter(Boolean)
  return { system, user: lines.join('\n') }
}

export class ListingsService {
  constructor(
    private readonly deps: {
      products: ProductRepository
      projects: ProjectRepository
      plans: PlanRepository
      images: ImageRepository
      brand: BrandRepository
      listings: ListingRepository
      usage: UsageRepository
      provider: TextProvider
      libraryPath: () => string
      logger: Logger
    }
  ) {}

  private async facts(productId: string, projectId: string | null): Promise<{
    facts: ListingFacts
    image: { mime: string; bytes: Buffer }
    plan: PlanJson | null
    projectId: string | null
    projectName: string
  }> {
    if (isBundledProduct(productId)) {
      throw new ListingError('invalid_payload', 'Save the included product as your own first.')
    }
    const product = this.deps.products.get(productId)
    if (!product) throw new ListingError('not_found')
    const row = this.deps.products.getRow(productId)
    if (!row) throw new ListingError('not_found')
    let bytes: Buffer
    try {
      bytes = await fs.readFile(absoluteInLibrary(this.deps.libraryPath(), row.file))
    } catch {
      throw new ListingError('not_found', 'The product photo is missing.')
    }
    const project = projectId ? this.deps.projects.get(projectId) : this.deps.projects.list({ productId, filter: 'sets', limit: 1 }).items[0] ?? null
    const plan = project ? this.deps.plans.getActive(project.id)?.json ?? null : null
    const brand = this.deps.brand.get()
    const shots = plan
      ? plan.shots
          .filter((shot) => shot.enabled)
          .map((shot) => ({
            label: shotDefinition(shot.type).label,
            direction: shot.direction.trim() || shotDefinition(shot.type).defaultDirection
          }))
      : []
    return {
      facts: {
        product: product.name,
        category: product.category ?? plan?.category ?? '',
        audience: product.audience ?? '',
        notes: [product.notes, product.analysis?.points?.join('; ')].filter(Boolean).join(' '),
        shots,
        profile: {
          businessName: brand.businessName ?? '',
          sells: brand.sells ?? '',
          audience: brand.audience ?? '',
          voice: brand.voice ?? '',
          policies: brand.policies ?? '',
          marketplaces: brand.marketplaces ?? []
        }
      },
      image: { mime: 'image/webp', bytes },
      plan,
      projectId: project?.id ?? null,
      projectName: project?.name ?? product.name
    }
  }

  async generate(input: { productId: string; platform: string; projectId?: string | null; useProfile?: boolean }): Promise<{
    id: string
    version: number
    copy: ListingCopy
  }> {
    const limits = limitsFor(input.platform)
    const built = await this.facts(input.productId, input.projectId ?? null)
    const facts = input.useProfile === false
      ? {
          ...built.facts,
          profile: { businessName: '', sells: '', audience: '', voice: '', policies: '', marketplaces: [] }
        }
      : built.facts
    const prompt = promptFor(facts, limits)
    const result = await this.deps.provider.generate({ ...prompt, image: built.image })
    if (!result.ok) {
      this.deps.usage.record({
        projectId: built.projectId,
        projectName: built.projectName,
        action: 'listing',
        requestedN: 0,
        returnedN: 0,
        costCents: 0,
        costMicros: 0,
        result: 'failed',
        errorCode: result.code,
        requestId: result.requestId
      })
      throw new ListingError(result.code)
    }
    const parsed = extractJsonObject(result.content)
    if (!parsed || typeof parsed !== 'object') throw new ListingError('invalid_request', 'The writer did not return a usable listing.')
    const raw = parsed as { titles?: unknown; description?: unknown; features?: unknown; tags?: unknown }
    const clamped = clampListingCopy(raw, limits.platform)
    if (!clamped.titles.length || !clamped.description.trim()) {
      throw new ListingError('invalid_request', 'The writer did not return usable text.')
    }
    const shots = built.plan?.shots.filter((shot) => shot.enabled) ?? []
    const altTexts = shots.length
      ? shots.map((shot) => {
          const definition = shotDefinition(shot.type)
          return altFor(facts.product, definition.label, shot.direction.trim() || definition.defaultDirection)
        })
      : [altFor(facts.product, 'Product photo', built.facts.category || 'the product')]
    const copy: ListingCopy = {
      ...clamped,
      altTexts,
      createdAt: Date.now(),
      costMicros: result.costMicros
    }
    const saved = this.deps.listings.save(input.productId, copy)
    this.deps.usage.record({
      projectId: built.projectId,
      projectName: built.projectName,
      action: 'listing',
      requestedN: 0,
      returnedN: 0,
      costCents: 0,
      costMicros: result.costMicros,
      result: 'ok',
      requestId: result.requestId
    })
    this.deps.logger.info('listings', 'generated', { count: copy.titles.length })
    return { id: saved.id, version: saved.version, copy: saved.copy }
  }

  get(productId: string, platform: string): { id: string; version: number; copy: ListingCopy } | null {
    const found = this.deps.listings.latest(productId, platform)
    return found ? { id: found.id, version: found.version, copy: found.copy } : null
  }

  save(input: { productId: string; platform: string; copy: Partial<ListingCopy> }): { id: string; version: number; copy: ListingCopy } {
    const limits = limitsFor(input.platform)
    const clamped = clampListingCopy(input.copy, limits.platform)
    if (!clamped.titles.length || !clamped.description.trim()) {
      throw new ListingError('invalid_payload', 'A listing needs at least one title and a description.')
    }
    const copy: ListingCopy = {
      ...clamped,
      altTexts: Array.isArray(input.copy.altTexts)
        ? input.copy.altTexts.map((value) => String(value).trim().slice(0, 250)).filter(Boolean)
        : [],
      createdAt: Date.now(),
      costMicros: Number(input.copy.costMicros) || 0
    }
    const saved = this.deps.listings.save(input.productId, copy)
    return { id: saved.id, version: saved.version, copy: saved.copy }
  }
}
