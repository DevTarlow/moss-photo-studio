import { create } from 'zustand'

export type ToastTone = 'status' | 'error'
export interface ToastItem {
  id: string
  tone: ToastTone
  message: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastStore {
  items: ToastItem[]
  push: (item: Omit<ToastItem, 'id'>) => string
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (item) => {
    const id = crypto.randomUUID()
    set((state) => ({ items: [...state.items, { ...item, id }] }))
    return id
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
}))

export const toast = {
  status(message: string, action?: { label: string; onClick: () => void }): void {
    useToastStore.getState().push({ tone: 'status', message, actionLabel: action?.label, onAction: action?.onClick })
  },
  error(message: string): void {
    useToastStore.getState().push({ tone: 'error', message })
  }
}
