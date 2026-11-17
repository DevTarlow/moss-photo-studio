export interface LicenseProvider {
  activate(input: { key: string; instanceName: string }): Promise<ActivateOutcome>
  validate(input: { key: string; instanceId: string }): Promise<ValidateOutcome>
  deactivate(input: { key: string; instanceId: string }): Promise<DeactivateOutcome>
}

export type LicenseProviderError = 'license_limit' | 'license_invalid' | 'license_offline' | 'unknown'

export type ActivateOutcome =
  | { ok: true; instanceId: string; status: string; product: string | null }
  | { ok: false; code: LicenseProviderError }

export type ValidateOutcome =
  | { ok: true; status: string; product: string | null }
  | { ok: false; code: LicenseProviderError }

export type DeactivateOutcome =
  | { ok: true }
  | { ok: false; code: LicenseProviderError }
