import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { APP_ID } from '@shared/constants'

export interface MachineIdentity {
  machineId: string
  fingerprint: string
  label: string
}

function readMachineId(userDataDir: string): string {
  try {
    if (process.platform === 'linux') {
      for (const file of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        if (fs.existsSync(file)) {
          const value = fs.readFileSync(file, 'utf8').trim()
          if (value) return value
        }
      }
    } else if (process.platform === 'win32') {
      const output = execFileSync(
        'reg',
        ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
        { encoding: 'utf8', timeout: 3000 }
      )
      const match = /MachineGuid\s+REG_SZ\s+([^\s]+)/i.exec(output)
      if (match?.[1]) return match[1]
    } else if (process.platform === 'darwin') {
      const output = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {
        encoding: 'utf8',
        timeout: 3000
      })
      const match = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(output)
      if (match?.[1]) return match[1]
    }
  } catch {
    // Fall through to the persisted random identity.
  }
  const fallbackFile = path.join(userDataDir, '.machine-id')
  try {
    if (fs.existsSync(fallbackFile)) {
      const value = fs.readFileSync(fallbackFile, 'utf8').trim()
      if (value) return value
    }
    const value = crypto.randomUUID()
    fs.mkdirSync(path.dirname(fallbackFile), { recursive: true, mode: 0o700 })
    fs.writeFileSync(fallbackFile, value, { mode: 0o600 })
    return value
  } catch {
    return crypto.randomUUID()
  }
}

export function machineIdentity(userDataDir: string): MachineIdentity {
  const machineId = readMachineId(userDataDir)
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${machineId}${APP_ID}`)
    .digest('hex')
    .slice(0, 12)
  return {
    machineId,
    fingerprint,
    // The store only needs a label a seller can recognize when two machines
    // are activated. Deriving it from the local fingerprint keeps the label
    // stable for this machine and makes a copied app-data folder look like a
    // different computer. The raw machine id, hostname, and hardware serial
    // are never sent.
    label: `${process.platform}-${fingerprint}`
  }
}
