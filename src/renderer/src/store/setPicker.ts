import { create } from 'zustand'
import type { Image } from '@shared/types'

interface SetPickerStore {
  image: Image | null
  open: (image: Image) => void
  close: () => void
}

export const useSetPickerStore = create<SetPickerStore>((set) => ({
  image: null,
  open: (image) => set({ image }),
  close: () => set({ image: null })
}))

export function openSetPicker(image: Image): void {
  useSetPickerStore.getState().open(image)
}
