import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { hasValidatedApiKey, postToolRequest, resolveApiKey } from './client.js'

const ORIGINAL_KEY = process.env.ADPANEL_API_KEY

function setKey(value: string | undefined) {
  if (value === undefined) delete process.env.ADPANEL_API_KEY
  else process.env.ADPANEL_API_KEY = value
}

afterEach(() => {
  setKey(ORIGINAL_KEY)
  mock.reset()
})

describe('hasValidatedApiKey', () => {
  it('is false when unset', () => {
    setKey(undefined)
    assert.equal(hasValidatedApiKey(), false)
  })

  it('is false for the placeholder value shipped in .env.example', () => {
    setKey('your_adpanel_key_here')
    assert.equal(hasValidatedApiKey(), false)
  })

  it('is false for a blank/whitespace-only value', () => {
    setKey('   ')
    assert.equal(hasValidatedApiKey(), false)
  })

  it('is true for a real-looking key', () => {
    setKey('adp_live_abc123')
    assert.equal(hasValidatedApiKey(), true)
  })
})

describe('resolveApiKey', () => {
  it('throws a helpful error when no key is configured', () => {
    setKey(undefined)
    assert.throws(() => resolveApiKey(), /ADPANEL_API_KEY is not configured/)
  })

  it('returns the trimmed key when present', () => {
    setKey('  adp_live_abc123  ')
    assert.equal(resolveApiKey(), 'adp_live_abc123')
  })
})

describe('postToolRequest', () => {
  beforeEach(() => {
    setKey('adp_live_abc123')
  })

  it('sends a bearer-authenticated envelope and returns the parsed payload', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
      assert.equal(init.method, 'POST')
      assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer adp_live_abc123')
      assert.deepEqual(JSON.parse(init.body as string), {
        tool: 'adpanel_ingest_brand_matrix',
        arguments: { brandName: 'Acme' },
        client: { name: 'adpanel-core', version: '0.1.0' },
      })
      return new Response(JSON.stringify({ ok: true, sessionId: 'sess_123' }), { status: 200 })
    })

    const result = await postToolRequest('adpanel_ingest_brand_matrix', { brandName: 'Acme' }, '0.1.0')

    assert.equal(fetchMock.mock.callCount(), 1)
    assert.deepEqual(result, { ok: true, sessionId: 'sess_123' })
  })

  it('throws the gateway-provided message on a non-2xx response', async () => {
    mock.method(globalThis, 'fetch', async () =>
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    await assert.rejects(
      postToolRequest('adpanel_ingest_brand_matrix', {}, '0.1.0'),
      /Unauthorized/
    )
  })

  it('falls back to a status-based message when the error body is not JSON', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('<html>502</html>', { status: 502 }))

    await assert.rejects(
      postToolRequest('adpanel_ingest_brand_matrix', {}, '0.1.0'),
      /Gateway request failed \(502\)/
    )
  })

  it('surfaces a clear timeout message instead of a raw abort error', async () => {
    mock.method(globalThis, 'fetch', async () => {
      throw Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      })
    })

    await assert.rejects(
      postToolRequest('adpanel_ingest_brand_matrix', {}, '0.1.0'),
      /timed out after 30000ms/
    )
  })
})
