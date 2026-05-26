import { describe, it, expect } from 'vitest'
import { statusToToast, networkErrorToast } from '@/lib/download-toast'

describe('statusToToast', () => {
  it('maps 404 → "File not found"', () => {
    expect(statusToToast(404)).toEqual({
      message: 'File not found',
      dataStatus: '404',
    })
  })

  it('maps 403 → "You don\'t have access to this file"', () => {
    expect(statusToToast(403)).toEqual({
      message: "You don't have access to this file",
      dataStatus: '403',
    })
  })

  it('maps 500 → "Server error — please try again later"', () => {
    expect(statusToToast(500)).toEqual({
      message: 'Server error — please try again later',
      dataStatus: '500',
    })
  })

  it('maps 503 → "Service temporarily unavailable"', () => {
    expect(statusToToast(503)).toEqual({
      message: 'Service temporarily unavailable',
      dataStatus: '503',
    })
  })

  it('falls back to generic "Download failed (HTTP <status>)" for unknown status', () => {
    expect(statusToToast(418)).toEqual({
      message: 'Download failed (HTTP 418)',
      dataStatus: '418',
    })
    expect(statusToToast(429)).toEqual({
      message: 'Download failed (HTTP 429)',
      dataStatus: '429',
    })
  })
})

describe('networkErrorToast', () => {
  it('returns network-error message with dataStatus "network"', () => {
    expect(networkErrorToast()).toEqual({
      message: 'Download failed — check your connection',
      dataStatus: 'network',
    })
  })
})
