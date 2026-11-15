import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowDownToLine } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { AutoUpdateState, JobState } from '@shared/types'
import { useAppStore } from './store/app'
import { useJobsStore } from './store/jobs'
import { useUiStore } from './store/ui'
import { useWorkspaceStore } from './store/workspace'
import { markUrl } from './lib/assets'
import { unwrap } from './lib/ipc'
import { fileToBytes } from './lib/files'
import { warnIfSmallPhoto } from './lib/photoWarnings'
import { toast } from './lib/toast'
import { emitCommand } from './lib/commands'
import { EMPTY_MENU_CONTEXT } from '@shared/constants'
import { useConfirm } from './components/ui/ConfirmProvider'
import { Button } from './components/ui/Button'
import { ToastViewport } from './components/ui/Toast'
import { CommandPalette } from './components/ui/CommandPalette'
import { ShortcutsSheet } from './components/ui/ShortcutsSheet'
import { GuideDialog } from './components/ui/GuideDialog'

const TWELVE_HOURS = 12 * 60 * 60 * 1000

function titleForPath(pathname: string): string {
  if (pathname.startsWith('/project/')) return 'Project · Moss Photo Studio'
  const section = pathname.split('/')[1] || 'studio'
  const labels: Record<string, string> = {
    library: 'Library',
    products: 'Products',
    people: 'People',
    usage: 'Usage',
    settings: 'Settings',
    onboarding: 'Setup',
    activation: 'Activate'
  }
  return `${labels[section] ?? 'Studio'} · Moss Photo Studio`
}

function Splash(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center" style={{ background: 'var(--canvas)' }}>
      <div className="flex flex-col items-center gap-3">
        <img src={markUrl()} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
        <p className="wordmark" style={{ color: 'var(--canvas-text)' }}>Moss Photo Studio</p>
      </div>
    </div>
  )
}

function BootError(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <h1 className="page-title">Could not open the studio.</h1>
      <p className="meta mt-2">Nothing is lost. Your images stay in the library folder.</p>
      <Button variant="primary" className="mt-5" onClick={() => window.location.reload()}>Try Again</Button>
    </div>
  )
}

function useJobCompletionToast(): void {
  const navigate = useNavigate()
  useEffect(() => {
    return window.moss.onJobUpdate((job: JobState) => {
      if (job.status === 'running') return
      if (window.location.hash.includes(job.projectId)) return
      if (window.location.hash.includes('/onboarding')) return
      if (job.status === 'cancelled') return
      if (job.done > 0) {
        const message = job.kind === 'create'
          ? `${job.done} ${job.done === 1 ? 'image is' : 'images are'} ready.`
          : 'Your change is ready.'
        toast.status(message, { label: 'Open project', onClick: () => navigate(`/project/${job.projectId}`) })
      } else {
        toast.error('That run finished without an image. Nothing is lost. Open the project to try again.')
      }
    })
  }, [navigate])
}

function UpdateNotice(): React.JSX.Element | null {
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<AutoUpdateState | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void window.moss.updates.state()
      .then((result) => {
        if (result.ok && active) setState(result.data)
      })
      .catch(() => undefined)
    const unsubscribe = window.moss.onUpdateState((next) => setState(next))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    setDismissed(null)
  }, [state?.version])

  if (!state?.supported || !['available', 'downloading', 'ready'].includes(state.status)) return null
  if (location.pathname === '/settings/updates') return null
  if (dismissed && dismissed === state.version) return null

  const ready = state.status === 'ready'
  const percent = state.progress === null ? null : Math.round(state.progress)
  const message = ready
    ? `Version ${state.version ?? 'the new build'} is ready. Restart when you are ready.`
    : state.status === 'downloading'
      ? `Downloading ${state.version ?? 'the update'}${percent === null ? '' : ` (${percent}%)`}.`
      : `Version ${state.version ?? 'a new build'} is available.`

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-[390px] rounded-[10px] border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}
    >
      <p className="text-[13px] font-semibold">Update {state.version ?? ''}</p>
      <p className="hint mt-1">{message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => navigate('/settings/updates')}>
          Review Update
        </Button>
        {ready && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void unwrap(window.moss.updates.install()).catch(() => undefined)
            }}
          >
            Restart
          </Button>
        )}
        <button
          type="button"
          className="hint ml-auto underline"
          onClick={() => setDismissed(state.version)}
        >
          Later
        </button>
      </div>
    </div>
  )
}

function useGlobalDrop(): { dragOver: boolean } {
  const [dragOver, setDragOver] = useState(false)
  const depth = useRef(0)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const hasFiles = (event: DragEvent): boolean => Boolean(event.dataTransfer?.types.includes('Files'))
    const onDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth.current += 1
      if (!location.pathname.startsWith('/library')) setDragOver(true)
    }
    const onDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (): void => {
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragOver(false)
    }
    const onDrop = async (event: DragEvent): Promise<void> => {
      event.preventDefault()
      depth.current = 0
      setDragOver(false)
      const file = [...(event.dataTransfer?.files ?? [])].find((entry) =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(entry.type)
      )
      if (!file) {
        toast.error('That file is not a JPEG, PNG, or WebP photo.')
        return
      }
      const bytes = await fileToBytes(file)
      const pathMatch = /\/project\/([^/?#]+)/.exec(location.pathname)
      if (pathMatch?.[1]) {
        const projectId = pathMatch[1]
        const ok = await confirm({
          title: 'Add this photo?',
          body: 'It becomes a new version source. The versions you have stay.',
          confirmLabel: 'Add Photo'
        })
        if (!ok) return
        try {
          const result = await unwrap(window.moss.media.importBytes({
            projectId,
            kind: 'source',
            bytes,
            mime: file.type,
            name: file.name
          }))
          warnIfSmallPhoto(result)
          if (result?.imageId) await useWorkspaceStore.getState().refresh(result.imageId)
          toast.status('Photo added.')
        } catch {
          toast.error('That photo could not be added. Try another one.')
        }
        return
      }
      try {
        const result = await unwrap(window.moss.media.importBytes({
          kind: 'source',
          type: 'photo',
          bytes,
          mime: file.type,
          name: file.name
        }))
        warnIfSmallPhoto(result)
        if (result?.projectId) navigate(`/project/${result.projectId}`)
      } catch {
        toast.error('That photo could not be opened. Try another one.')
      }
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [confirm, location.pathname, navigate])

  return { dragOver }
}

export function RootLayout(): React.JSX.Element {
  const booted = useAppStore((state) => state.booted)
  const bootError = useAppStore((state) => state.bootError)
  const boot = useAppStore((state) => state.boot)
  const license = useAppStore((state) => state.license)
  const settings = useAppStore((state) => state.settings)
  const onboardingBypass = useAppStore((state) => state.onboardingBypass)
  const initialLicenseValid = useAppStore((state) => state.initialLicenseValid)
  const readonlyBypass = useAppStore((state) => state.readonlyBypass)
  const applyLicense = useAppStore((state) => state.applyLicense)
  const refreshLicense = useAppStore((state) => state.refreshLicense)
  const setTheme = useAppStore((state) => state.setTheme)
  const setPalette = useUiStore((state) => state.setPalette)
  const toggleRail = useUiStore((state) => state.toggleRail)
  const setShortcuts = useUiStore((state) => state.setShortcuts)
  const setGuide = useUiStore((state) => state.setGuide)
  const jobsRevision = useJobsStore((state) => state.revision)
  const navigate = useNavigate()
  const location = useLocation()
  const previousLicense = useRef<string | null>(null)
  const { dragOver } = useGlobalDrop()
  useJobCompletionToast()

  useEffect(() => {
    document.body.classList.add(`platform-${window.moss.platform}`)
    if (!useAppStore.getState().booted) void boot()
  }, [])

  useEffect(() => {
    document.title = titleForPath(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    if (!booted) return
    if (location.pathname.startsWith('/project/')) return
    void window.moss.app.setMenuContext(EMPTY_MENU_CONTEXT).catch(() => undefined)
  }, [booted, location.pathname])

  useEffect(() => {
    if (!booted) return
    const unsubscribeJobs = useJobsStore.getState().subscribe()
    void useJobsStore.getState().loadActive()
    const unsubscribeLicense = window.moss.onLicenseChanged((state) => {
      const previous = previousLicense.current
      applyLicense(state)
      if (state.status === 'grace' && previous !== 'grace') {
        toast.status("Working offline. License checks resume when you're connected.")
      } else if (state.status === 'expired' && previous !== 'expired') {
        toast.error('The license needs attention. Your library, edits and exports still work.')
      }
      previousLicense.current = state.status
    })
    previousLicense.current = useAppStore.getState().license?.status ?? null
    return () => {
      unsubscribeJobs()
      unsubscribeLicense()
    }
  }, [applyLicense, booted])

  useEffect(() => {
    if (!booted) return
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement
      const typing = target.matches('input, textarea, select, [contenteditable="true"]')
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPalette(true)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        if (location.pathname.startsWith('/library')) emitCommand('focus-search')
        else navigate('/library?focus=search')
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        navigate('/library?new=photo')
        return
      }
      if ((event.metaKey || event.ctrlKey) && (event.key === '1' || event.key === '2')) {
        event.preventDefault()
        if (event.key === '1') {
          navigate('/library?new=photo')
        } else {
          void unwrap(window.moss.projects.create({ type: 'image', draft: true })).then((detail) => navigate(`/project/${detail.project.id}`)).catch(() => toast.error('A new project could not be opened.'))
        }
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        emitCommand('export')
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (!location.pathname.startsWith('/project/')) return
        const primary = document.querySelector<HTMLButtonElement>('.ws-bottom .btn-primary:not([disabled])')
        if (primary) primary.click()
        else toast.error('There is no action to run here yet.')
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggleRail()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault()
        setShortcuts(true)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v' && !typing) {
        event.preventDefault()
        void pasteAsPhoto()
        return
      }
      if (event.key === '?' && !typing) {
        event.preventDefault()
        setShortcuts(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [booted, location.pathname, navigate, setPalette, setShortcuts, toggleRail])

  const pasteAsPhoto = async (): Promise<void> => {
    try {
      const clipboard = await unwrap(window.moss.app.readClipboardImage())
      if (!clipboard.bytes || !clipboard.mime) {
        toast.error('There is no image on the clipboard.')
        return
      }
      const result = await unwrap(window.moss.media.importBytes({
        kind: 'source',
        type: 'photo',
        bytes: clipboard.bytes,
        mime: clipboard.mime,
        name: 'Pasted photo'
      }))
      if (result?.projectId) navigate(`/project/${result.projectId}`)
    } catch {
      toast.error('That image could not be pasted.')
    }
  }

  useEffect(() => {
    if (!booted) return
    return window.moss.onMenuAction((event) => {
      switch (event.action) {
        case 'new-photo':
          navigate('/library?new=photo')
          break
        case 'new-image':
          void unwrap(window.moss.projects.create({ type: 'image', draft: true })).then((detail) => navigate(`/project/${detail.project.id}`)).catch(() => toast.error('A new project could not be opened.'))
          break
        case 'open-project':
          if (event.projectId) navigate(`/project/${event.projectId}`)
          break
        case 'export':
          if (location.pathname.startsWith('/project/')) emitCommand('export')
          else toast.error('Open a project to export it.')
          break
        case 'find':
          if (location.pathname.startsWith('/library')) emitCommand('focus-search')
          else navigate('/library?focus=search')
          break
        case 'toggle-rail':
          toggleRail()
          break
        case 'toggle-panel':
          emitCommand('toggle-panel')
          break
        case 'open-settings':
          navigate('/settings/studio')
          break
        case 'open-usage':
          navigate('/usage')
          break
        case 'open-privacy':
          navigate('/settings/privacy')
          break
        case 'open-about':
          navigate('/settings/about')
          break
        case 'open-guide':
          setGuide(true)
          break
        case 'open-shortcuts':
          setShortcuts(true)
          break
        case 'theme-system':
        case 'theme-light':
        case 'theme-dark':
          void setTheme(event.action === 'theme-system' ? 'system' : event.action === 'theme-light' ? 'light' : 'dark').catch(() => toast.error('The theme could not be changed.'))
          break
        case 'undo':
          emitCommand('undo')
          break
        case 'redo':
          emitCommand('redo')
          break
        case 'copy-image':
          emitCommand('copy-image')
          break
        case 'paste-image':
          void pasteAsPhoto()
          break
        case 'zoom-in':
          emitCommand('zoom-in')
          break
        case 'zoom-out':
          emitCommand('zoom-out')
          break
        case 'zoom-reset':
        case 'actual-size':
          emitCommand('zoom-reset')
          break
        case 'toggle-theme':
          void setTheme(settings?.theme === 'dark' ? 'light' : 'dark').catch(() => toast.error('The theme could not be changed.'))
          break
        default:
          break
      }
    })
  }, [booted, location.pathname, navigate, setGuide, setShortcuts, setTheme, settings?.theme, toggleRail])

  useEffect(() => {
    if (location.pathname === '/' && booted) {
      // BootRedirect handles root. A license check result can arrive late.
      if (license?.status === 'licensed' || license?.status === 'grace') void refreshLicense()
    }
  }, [booted, license?.status, location.pathname, refreshLicense])
  void jobsRevision

  if (!booted) return <Splash />
  if (bootError) return <BootError />

  const licenseInvalid = !license || license.status === 'unlicensed' || license.status === 'offline_unlicensed' || license.status === 'expired'
  if (licenseInvalid && !initialLicenseValid && !readonlyBypass && location.pathname !== '/activation') {
    return <Navigate to="/activation" replace />
  }
  if (
    license &&
    (license.status === 'licensed' || license.status === 'grace') &&
    settings &&
    !settings.onboardingDone &&
    !settings.onboardingDismissed &&
    !onboardingBypass &&
    location.pathname !== '/onboarding' &&
    location.pathname !== '/activation'
  ) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <>
      <Outlet />
      <UpdateNotice />
      <CommandPalette />
      <ShortcutsSheet />
      <GuideDialog />
      <ToastViewport />
      {dragOver && (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-overlay-inner flex items-center gap-2">
            <Icon icon={ArrowDownToLine} size="md" /> Drop to add a photo or image.
          </div>
        </div>
      )}
    </>
  )
}

export { TWELVE_HOURS }
