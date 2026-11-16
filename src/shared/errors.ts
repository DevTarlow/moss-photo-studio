import type { ErrorCode } from './types'

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  content_policy: "That request doesn't fit Meta's image policy. Try rewording it.",
  invalid_key: "Meta didn't accept the key. Check it in Settings, then try again.",
  billing: 'Meta declined the charge. Check the payment method on your Meta account.',
  forbidden: "Meta refused this key for that request. Check the key's permissions.",
  misconfigured: 'Meta could not find that service. Update the app and try again.',
  rate_limited: 'Meta is busy right now. Try again in a minute.',
  provider_error: 'No image came back. If Meta made one, it may show on your Meta bill.',
  network:
    'The request timed out. If Meta made the image, it may appear on your Meta bill. Try again to make a new one.',
  app_bug: "Something in the app sent a setting Meta doesn't accept. Update the app.",
  invalid_request: 'Meta refused that request. Try a shorter description or a different photo.',
  aborted: 'That change was stopped.',
  unlicensed: 'Reactivate to make images.',
  unlicensed_library: 'Reactivate to make images.',
  no_key: 'Add your Meta key in Settings to make images.',
  budget: 'This run would pass your monthly limit. Raise it in Usage, or make fewer images.',
  disk_full:
    'The image was made but could not be saved. Meta may bill for it. Free some space and try again.',
  not_saved: 'The image was made but could not be saved. Meta may bill for it. Free some space and try again.',
  unknown_channel: 'The app tried something it does not know. Restart it and try again.',
  invalid_payload: 'Something in the app sent an invalid request. Try again.',
  not_found: 'That item is not here anymore.',
  conflict: 'That item is already being made.',
  license_limit:
    'This key has used both of its computers. Deactivate it on the other computer in Settings, or contact support, then try again.',
  license_invalid: "That key wasn't accepted. Check it and try again.",
  license_offline: 'Could not reach the license server. Connect to the internet and try again.',
  already_running: 'This project is already making images.',
  unsupported_type: "That file isn't a JPEG, PNG, or WebP photo.",
  too_large: 'That photo is larger than 40 MB. Try a smaller one.',
  too_small: 'That photo is too small to work with. Try one at least 256 pixels wide.',
  unreadable: 'That photo could not be read. Try another one.',
  cancelled: 'That was stopped.',
  export_failed: 'Those images could not be exported. Nothing is lost. Try again.',
  unknown: 'Something went wrong. Try again.'
}

export function errorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code]
}

/** The uncertain-billing line is forbidden for 4xx refusals and empty responses. */
export function billingUncertain(code: ErrorCode | null | undefined): boolean {
  return code === 'network' || code === 'provider_error' || code === 'rate_limited'
}

export function apiFailureMessage(code: ErrorCode, returned = 0): string {
  if (returned > 0) return `Only ${returned} came back. Meta charged for the images it returned.`
  return ERROR_MESSAGES[code]
}
