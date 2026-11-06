import { useEffect, useState } from 'react'

export type ViewportTier = 'wide' | 'medium' | 'narrow' | 'tiny'

export function getViewportTier(width: number): ViewportTier {
  if (width >= 1280) return 'wide'
  if (width >= 1000) return 'medium'
  if (width >= 840) return 'narrow'
  return 'tiny'
}

export function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(() => getViewportTier(window.innerWidth))
  useEffect(() => {
    const update = (): void => setTier(getViewportTier(window.innerWidth))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return tier
}
