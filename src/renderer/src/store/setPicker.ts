import { create } from 'zustand'
import type { Image, Product } from '@shared/types'

export type SetTarget =
  | { kind: 'image'; image: Image; onSaved?: (setId: string | null) => void }
  | { kind: 'product'; product: Product; onSaved?: (setId: string | null) => void }

interface SetPickerStore {
  target: SetTarget | null
  open: (target: SetTarget) => void
  close: () => void
}

export const useSetPickerStore = create<SetPickerStore>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null })
}))

export function openSetPicker(image: Image): void {
  useSetPickerStore.getState().open({ kind: 'image', image })
}

export function openProductSetPicker(product: Product, onSaved?: (setId: string | null) => void): void {
  useSetPickerStore.getState().open({ kind: 'product', product, onSaved })
}
