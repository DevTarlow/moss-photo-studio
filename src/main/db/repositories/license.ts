import type { Db } from '../connection'
import type { LicenseState } from '@shared/types'

export interface LicenseRow {
  id: string
  key_enc: string | null
  instance_id: string | null
  machine_label: string | null
  status: string
  activated_at: number | null
  last_validated_at: number | null
  source: string
}

export class LicenseRepository {
  constructor(private readonly db: Db) {}

  getRow(): LicenseRow | null {
    return (this.db.prepare('SELECT * FROM license LIMIT 1').get() as LicenseRow | undefined) ?? null
  }

  save(input: {
    keyEnc: string | null
    instanceId: string | null
    machineLabel: string | null
    status: string
    activatedAt: number | null
    lastValidatedAt: number | null
    source: string
  }): void {
    const existing = this.getRow()
    if (existing) {
      this.db
        .prepare(
          `UPDATE license SET key_enc = ?, instance_id = ?, machine_label = ?, status = ?, activated_at = ?,
            last_validated_at = ?, source = ? WHERE id = ?`
        )
        .run(
          input.keyEnc,
          input.instanceId,
          input.machineLabel,
          input.status,
          input.activatedAt,
          input.lastValidatedAt,
          input.source,
          existing.id
        )
    } else {
      this.db
        .prepare(
          `INSERT INTO license (id, key_enc, instance_id, machine_label, status, activated_at,
             last_validated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          crypto.randomUUID(),
          input.keyEnc,
          input.instanceId,
          input.machineLabel,
          input.status,
          input.activatedAt,
          input.lastValidatedAt,
          input.source
        )
    }
  }

  clear(): void {
    this.db.prepare('DELETE FROM license').run()
  }
}
