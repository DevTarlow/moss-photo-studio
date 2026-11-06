export async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

export function isSupportedImage(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
}

export function droppedImages(event: DragEvent): File[] {
  const files = event.dataTransfer?.files
  if (!files) return []
  return [...files].filter(isSupportedImage)
}

export function imageFiles(event: React.DragEvent | DragEvent): File[] {
  const native = 'dataTransfer' in event ? event.dataTransfer : null
  if (!native) return []
  return [...native.files].filter(isSupportedImage)
}

export function downloadUrl(url: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
}
