import type { MossApi } from '../shared/ipc'

declare global {
  interface Window {
    moss: MossApi
  }
}

export {}
