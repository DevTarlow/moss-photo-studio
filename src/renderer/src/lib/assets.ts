import { bundledUrl } from '@shared/files'

export { bundledUrl }
export const markUrl = (): string => bundledUrl('brand/mark.png')
export const exampleUrl = (name: 'product' | 'lifestyle' | 'flatlay' | 'gift' | 'main'): string =>
  bundledUrl(`tiles/examples/${name}.webp`)
