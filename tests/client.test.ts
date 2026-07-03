import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasValidatedApiKey, postToolRequest, resolveApiKey } from '../src/client.js'

const ORIGINAL_API_KEY = process.env.ADPANEL_API_KEY

afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.ADPANEL_API_KEY
  } else {
    process.env.ADPANEL_API_KEY = ORIGINAL_API_KEY
  }
  vi.unstubAllGlobals()
})

describe('hasValidatedApiKey', () => {
  it('returns false when the env var is unset', () => {
    delete process.env.ADPANEL_API_KEY
    expect(hasValidatedApiKey()).toBe(false)
  })

  it('returns false for an empty or whitespace-only value', () => {
    process.env.ADPANEL_API_KEY = '   '
    expect(hasValidatedApiKey()).toBe(false)
  })

  it('returns false for the placeholder value from .env.example', () => {
    process.env.ADPANEL_API_KEY = 'your_adpanel_key_here'
    expect(hasValidatedApiKey()).toBe(false)
  })

  it('returns true for a real-looking key', () => {
    process.env.ADPANEL_API_KEY = 'adp_realkey123'
    expect(hasValidatedApiKey()).toBe(true)
  })
})

describe('resolveApiKey', () => {
  it('throws a descriptive error when unset', () => {
    delete process.env.ADPANEL_API_KEY
    expect(() => resolveApiKey()).toThrow(/ADPANEL_API_KEY is not configured/)
  })

  it('throws for the placeholder value', () => {
    process.env.ADPANEL_API_KEY = 'your_adpanel_key_here'
    expect(() => resolveApiKey()).toThrow(/ADPANEL_API_KEY is not configured/)
  })

  it('returns the trimmed key when valid', () => {
    process.env.ADPANEL_API_KEY = '  adp_realkey123  '
    expect(resolveApiKey()).toBe('adp_realkey123')
  })
})

describe('postToolRequest', () => {
  beforeEach(() => {
    process.env.ADPANEL_API_KEY = 'adp_realkey123'
  })

  it('wraps an AbortSignal timeout into a descriptive error', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout')
    timeoutError.name = 'TimeoutError'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(timeoutError)
    )

    await expect(
      postToolRequest('adpanel_ingest_brand_matrix', { brandName: 'Acme' }, '0.1.0')
    ).rejects.toThrow(/timed out after \d+ms/)
  })

  it('propagates non-timeout network errors unchanged', async () => {
    const networkError = new TypeError('fetch failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError))

    await expect(
      postToolRequest('adpanel_ingest_brand_matrix', { brandName: 'Acme' }, '0.1.0')
    ).rejects.toThrow('fetch failed')
  })

  it('throws using the payload message when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid API key' }),
      })
    )

    await expect(
      postToolRequest('adpanel_ingest_brand_matrix', { brandName: 'Acme' }, '0.1.0')
    ).rejects.toThrow('Invalid API key')
  })

  it('falls back to a status-based error when the response has no body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json')
        },
      })
    )

    await expect(
      postToolRequest('adpanel_ingest_brand_matrix', { brandName: 'Acme' }, '0.1.0')
    ).rejects.toThrow(/Gateway request failed \(500\)/)
  })

  it('returns the parsed payload on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, sessionId: 'abc123' }),
      })
    )

    await expect(
      postToolRequest('adpanel_ingest_brand_matrix', { brandName: 'Acme' }, '0.1.0')
    ).resolves.toEqual({ ok: true, sessionId: 'abc123' })
  })
})
