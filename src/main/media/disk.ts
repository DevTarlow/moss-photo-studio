import fs from 'node:fs/promises'

/**
 * Free bytes on the filesystem that holds `dir`, or null when the platform
 * cannot answer. A null answer never blocks a run; the import path still
 * reports ENOSPC if the disk fills.
 */
export async function freeDiskBytes(dir: string): Promise<number | null> {
  try {
    const stats = await fs.statfs(dir)
    return Number(stats.bavail) * Number(stats.bsize)
  } catch {
    return null
  }
}

/** A paid run needs headroom for the response, the working copy, and a thumb. */
export async function hasDiskRoom(dir: string, neededBytes: number): Promise<boolean> {
  const free = await freeDiskBytes(dir)
  return free === null || free >= neededBytes
}
