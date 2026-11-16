import { create } from 'zustand'

interface UiStore {
  paletteOpen: boolean
  shortcutsOpen: boolean
  guideOpen: boolean
  metaKeyOpen: boolean
  budgetOpen: boolean
  railOverride: boolean | null
  setPalette: (open: boolean) => void
  setShortcuts: (open: boolean) => void
  setGuide: (open: boolean) => void
  setMetaKeyOpen: (open: boolean) => void
  setBudgetOpen: (open: boolean) => void
  toggleRail: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  guideOpen: false,
  metaKeyOpen: false,
  budgetOpen: false,
  railOverride: null,
  setPalette: (open) => set({ paletteOpen: open, shortcutsOpen: false, guideOpen: false, metaKeyOpen: false, budgetOpen: false }),
  setShortcuts: (open) => set({ shortcutsOpen: open, paletteOpen: false, guideOpen: false, metaKeyOpen: false, budgetOpen: false }),
  setGuide: (open) => set({ guideOpen: open, paletteOpen: false, shortcutsOpen: false, metaKeyOpen: false, budgetOpen: false }),
  setMetaKeyOpen: (open) => set({ metaKeyOpen: open, paletteOpen: false, shortcutsOpen: false, guideOpen: false, budgetOpen: false }),
  setBudgetOpen: (open) => set({ budgetOpen: open, paletteOpen: false, shortcutsOpen: false, guideOpen: false, metaKeyOpen: false }),
  toggleRail: () =>
    set((state) => ({
      railOverride: state.railOverride === null ? true : !state.railOverride
    }))
}))
