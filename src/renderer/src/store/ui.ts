import { create } from 'zustand'

interface UiStore {
  paletteOpen: boolean
  shortcutsOpen: boolean
  guideOpen: boolean
  railOverride: boolean | null
  setPalette: (open: boolean) => void
  setShortcuts: (open: boolean) => void
  setGuide: (open: boolean) => void
  toggleRail: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  guideOpen: false,
  railOverride: null,
  setPalette: (open) => set({ paletteOpen: open, shortcutsOpen: false, guideOpen: false }),
  setShortcuts: (open) => set({ shortcutsOpen: open, paletteOpen: false, guideOpen: false }),
  setGuide: (open) => set({ guideOpen: open, paletteOpen: false, shortcutsOpen: false }),
  toggleRail: () =>
    set((state) => ({
      railOverride: state.railOverride === null ? true : !state.railOverride
    }))
}))
