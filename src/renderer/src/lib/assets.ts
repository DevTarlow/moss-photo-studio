import { bundledUrl } from '@shared/files'
import type { ExampleSceneKey } from '@shared/starters'

export { bundledUrl }
export const markUrl = (): string => bundledUrl('brand/mark.png')
export const exampleUrl = (name: ExampleSceneKey | 'main'): string =>
  bundledUrl(`tiles/examples/${name}.webp`)
