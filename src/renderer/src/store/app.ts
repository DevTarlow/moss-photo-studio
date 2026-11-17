import { create } from 'zustand'
import type {
  AppInfo,
  Brand,
  LicenseState,
  Person,
  Product,
  SettingsAll,
  ThemeSetting,
  Format,
  Shape
} from '@shared/types'
import { unwrap } from '../lib/ipc'

export interface SecretStatus {
  hasKey: boolean
  last4: string | null
  validatedAt: number | null
  backend: string
}

interface AppStore {
  booted: boolean
  bootError: string | null
  appInfo: AppInfo | null
  settings: SettingsAll | null
  license: LicenseState | null
  secrets: SecretStatus | null
  brand: Brand | null
  people: Person[]
  products: Product[]
  readonlyBypass: boolean
  onboardingBypass: boolean
  initialLicenseValid: boolean
  boot: () => Promise<void>
  refreshAppInfo: () => Promise<void>
  refreshSettings: () => Promise<void>
  applyLicense: (state: LicenseState) => void
  refreshLicense: () => Promise<void>
  refreshSecrets: () => Promise<void>
  refreshBrand: () => Promise<void>
  refreshPeople: () => Promise<void>
  refreshProducts: () => Promise<void>
  setTheme: (theme: ThemeSetting) => Promise<void>
  setDefaultFormat: (format: Format) => Promise<void>
  setDefaultShape: (shape: Shape) => Promise<void>
  setReadonlyBypass: (value: boolean) => void
  setOnboardingBypass: (value: boolean) => void
  canGenerate: boolean
  canUseStudio: boolean
}

function applyThemeToDocument(theme: ThemeSetting): void {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  document.documentElement.dataset.theme = resolved
}

export const useAppStore = create<AppStore>((set, get) => ({
  booted: false,
  bootError: null,
  appInfo: null,
  settings: null,
  license: null,
  secrets: null,
  brand: null,
  people: [],
  products: [],
  readonlyBypass: false,
  onboardingBypass: false,
  initialLicenseValid: false,
  canGenerate: false,
  canUseStudio: false,
  boot: async () => {
    try {
      const [appInfo, settings, license, secrets, brand, people, products] = await Promise.all([
        unwrap(window.moss.app.info()),
        unwrap(window.moss.settings.all()),
        unwrap(window.moss.license.state()),
        unwrap(window.moss.secrets.status()),
        unwrap(window.moss.brand.get()),
        unwrap(window.moss.people.list()),
        unwrap(window.moss.products.list())
      ])
      applyThemeToDocument(settings.theme)
      document.documentElement.dataset.density = settings.density
      set({
        booted: true,
        bootError: null,
        appInfo,
        settings,
        license,
        secrets,
        brand,
        people,
        products,
        canGenerate: license.status === 'licensed' || license.status === 'grace',
        canUseStudio: license.status === 'licensed' || license.status === 'grace',
        initialLicenseValid: license.status === 'licensed' || license.status === 'grace'
      })
    } catch {
      set({ booted: true, bootError: 'Could not open the studio. Nothing is lost. Try again.' })
    }
  },
  refreshAppInfo: async () => {
    set({ appInfo: await unwrap(window.moss.app.info()) })
  },
  refreshSettings: async () => {
    const settings = await unwrap(window.moss.settings.all())
    applyThemeToDocument(settings.theme)
    document.documentElement.dataset.density = settings.density
    set({ settings })
  },
  applyLicense: (license) => {
    set({
      license,
      canGenerate: license.status === 'licensed' || license.status === 'grace',
      canUseStudio: license.status === 'licensed' || license.status === 'grace'
    })
  },
  refreshLicense: async () => {
    const license = await unwrap(window.moss.license.state())
    get().applyLicense(license)
  },
  refreshSecrets: async () => {
    set({ secrets: await unwrap(window.moss.secrets.status()) })
  },
  refreshBrand: async () => {
    set({ brand: await unwrap(window.moss.brand.get()) })
  },
  refreshPeople: async () => {
    set({ people: await unwrap(window.moss.people.list()) })
  },
  refreshProducts: async () => {
    set({ products: await unwrap(window.moss.products.list()) })
  },
  setTheme: async (theme) => {
    await unwrap(window.moss.settings.set({ key: 'theme', value: theme }))
    applyThemeToDocument(theme)
    const settings = get().settings
    if (settings) set({ settings: { ...settings, theme } })
  },
  setDefaultFormat: async (format) => {
    await unwrap(window.moss.settings.set({ key: 'defaultFormat', value: format }))
    const settings = get().settings
    if (settings) set({ settings: { ...settings, defaultFormat: format } })
  },
  setDefaultShape: async (shape) => {
    await unwrap(window.moss.settings.set({ key: 'defaultShape', value: shape }))
    const settings = get().settings
    if (settings) set({ settings: { ...settings, defaultShape: shape } })
  },
  setReadonlyBypass: (readonlyBypass) => set({ readonlyBypass }),
  setOnboardingBypass: (onboardingBypass) => set({ onboardingBypass })
}))

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const settings = useAppStore.getState().settings
  if (settings?.theme === 'system') applyThemeToDocument('system')
})
