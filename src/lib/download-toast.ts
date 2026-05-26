export type DownloadToast = {
  /** User-facing message shown inside the toast. */
  message: string
  /** Value for the toast's `data-status` attribute. HTTP status as a string for HTTP errors, or `"network"` for no-response failures. */
  dataStatus: string
}

const MESSAGES: Record<number, string> = {
  403: "You don't have access to this file",
  404: 'File not found',
  500: 'Server error — please try again later',
  503: 'Service temporarily unavailable',
}

/**
 * Map an HTTP response status to the toast contract from specs/09-download-toast.md §4.
 *
 * Unknown statuses (e.g. 418, 429) fall back to a generic toast — the spec
 * requires this branch to exist so students can probe it from Playwright via
 * `page.route()`.
 */
export function statusToToast(status: number): DownloadToast {
  const known = MESSAGES[status]
  if (known) return { message: known, dataStatus: String(status) }
  return { message: `Download failed (HTTP ${status})`, dataStatus: String(status) }
}

/**
 * Toast for the no-response case (fetch rejected — offline, aborted, DNS
 * failure, etc.). Carries the literal string `"network"` in `data-status`.
 */
export function networkErrorToast(): DownloadToast {
  return {
    message: 'Download failed — check your connection',
    dataStatus: 'network',
  }
}
