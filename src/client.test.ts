/**
 * Tests for the gateway HTTP client — key resolution, timeout config,
 * and the request-timeout / network-error handling in postToolRequest.
 */

import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  hasValidatedApiKey,
  postToolRequest,
  resolveApiKey,
  resolveTimeoutMs,
} from './client.js'

const ORIGINAL_ENV = { ...process.env }
const originalFetch = globalThis.fetch

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  globalThis.fetch = originalFetch
})

describe('hasValidatedApiKey', () => {
  it('is false when unset', () => {
    delete process.env.ADPANEL_API_KEY
    assert.equal(hasValidatedApiKey(), false)
  })

  it('is false for the placeholder value', () => {
    process.env.ADPANEL_API_KEY = 'your_adpanel_key_here'
    assert.equal(hasValidatedApiKey(), false)
  })

  it('is true for a real key (trimmed)', () => {
    process.env.ADPANEL_API_KEY = '  adp_live_key  '
    assert.equal(hasValidatedApiKey(), true)
  })
})

describe('resolveApiKey', () => {
  it('throws a helpful error when the key is missing', () => {
    delete process.env.ADPANEL_API_KEY
    assert.throws(() => resolveApiKey(), /ADPANEL_API_KEY is not configured/)
  })

  it('returns the trimmed key', () => {
    process.env.ADPANEL_API_KEY = '  adp_live_key  '
    assert.equal(resolveApiKey(), 'adp_live_key')
  })
})

describe('resolveTimeoutMs', () => {
  it('defaults to 30000 when unset', () => {
    delete process.env.ADPANEL_TIMEOUT_MS
    assert.equal(resolveTimeoutMs(), 30_000)
  })

  it('honors a valid override', () => {
    process.env.ADPANEL_TIMEOUT_MS = '5000'
    assert.equal(resolveTimeoutMs(), 5000)
  })

  it('falls back to the default on non-numeric or non-positive values', () => {
    process.env.ADPANEL_TIMEOUT_MS = 'not-a-number'
    assert.equal(resolveTimeoutMs(), 30_000)
    process.env.ADPANEL_TIMEOUT_MS = '0'
    assert.equal(resolveTimeoutMs(), 30_000)
    process.env.ADPANEL_TIMEOUT_MS = '-100'
    assert.equal(resolveTimeoutMs(), 30_000)
  })
})

describe('postToolRequest', () => {
  it('aborts and reports a timeout when the gateway hangs', async () => {
    process.env.ADPANEL_API_KEY = 'adp_live_key'
    process.env.ADPANEL_TIMEOUT_MS = '20'

    // Simulate a hanging gateway that only rejects once the request is aborted.
    globalThis.fetch = ((_input: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })) as typeof fetch

    await assert.rejects(
      postToolRequest('adpanel_ingest_brand_matrix', { brandName: 'x' }, '0.1.0'),
      /timed out after 20ms/
    )
  })

  it('wraps a network-level failure', async () => {
    process.env.ADPANEL_API_KEY = 'adp_live_key'
    delete process.env.ADPANEL_TIMEOUT_MS

    globalThis.fetch = (() =>
      Promise.reject(new TypeError('fetch failed'))) as typeof fetch

    await assert.rejects(
      postToolRequest('adpanel_ingest_brand_matrix', { brandName: 'x' }, '0.1.0'),
      /Gateway request failed: fetch failed/
    )
  })

  it('surfaces a gateway error message on a non-ok response', async () => {
    process.env.ADPANEL_API_KEY = 'adp_live_key'

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'quota exceeded' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
      )) as typeof fetch

    await assert.rejects(
      postToolRequest('adpanel_ingest_brand_matrix', { brandName: 'x' }, '0.1.0'),
      /quota exceeded/
    )
  })

  it('returns the parsed envelope on success', async () => {
    process.env.ADPANEL_API_KEY = 'adp_live_key'

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, routingRef: 'ref_123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )) as typeof fetch

    const result = await postToolRequest(
      'adpanel_ingest_brand_matrix',
      { brandName: 'x' },
      '0.1.0'
    )
    assert.deepEqual(result, { ok: true, routingRef: 'ref_123' })
  })
})
