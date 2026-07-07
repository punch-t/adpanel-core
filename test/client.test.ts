import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  hasValidatedApiKey,
  resolveApiKey,
  resolveTimeoutMs,
} from '../src/client.js'

const ORIGINAL = { ...process.env }

afterEach(() => {
  delete process.env.ADPANEL_API_KEY
  delete process.env.ADPANEL_TIMEOUT_MS
  Object.assign(process.env, ORIGINAL)
})

describe('resolveTimeoutMs', () => {
  it('falls back to the default when unset', () => {
    delete process.env.ADPANEL_TIMEOUT_MS
    assert.equal(resolveTimeoutMs(), 30_000)
  })

  it('parses a valid positive integer', () => {
    process.env.ADPANEL_TIMEOUT_MS = '5000'
    assert.equal(resolveTimeoutMs(), 5000)
  })

  it('floors fractional values', () => {
    process.env.ADPANEL_TIMEOUT_MS = '1500.9'
    assert.equal(resolveTimeoutMs(), 1500)
  })

  it('trims surrounding whitespace', () => {
    process.env.ADPANEL_TIMEOUT_MS = '  2500  '
    assert.equal(resolveTimeoutMs(), 2500)
  })

  it('falls back on non-numeric input', () => {
    process.env.ADPANEL_TIMEOUT_MS = 'abc'
    assert.equal(resolveTimeoutMs(), 30_000)
  })

  it('falls back on zero and negative values', () => {
    process.env.ADPANEL_TIMEOUT_MS = '0'
    assert.equal(resolveTimeoutMs(), 30_000)
    process.env.ADPANEL_TIMEOUT_MS = '-100'
    assert.equal(resolveTimeoutMs(), 30_000)
  })
})

describe('hasValidatedApiKey', () => {
  it('is false when unset', () => {
    delete process.env.ADPANEL_API_KEY
    assert.equal(hasValidatedApiKey(), false)
  })

  it('is false for placeholder values', () => {
    for (const placeholder of ['', 'your_adpanel_key_here', 'adp_your_key_here']) {
      process.env.ADPANEL_API_KEY = placeholder
      assert.equal(hasValidatedApiKey(), false, `expected placeholder "${placeholder}" to be invalid`)
    }
  })

  it('is true for a real key (trimmed)', () => {
    process.env.ADPANEL_API_KEY = '  adp_live_123  '
    assert.equal(hasValidatedApiKey(), true)
  })
})

describe('resolveApiKey', () => {
  it('throws when the key is a placeholder', () => {
    process.env.ADPANEL_API_KEY = 'adp_your_key_here'
    assert.throws(() => resolveApiKey(), /ADPANEL_API_KEY is not configured/)
  })

  it('returns the trimmed key when set', () => {
    process.env.ADPANEL_API_KEY = '  adp_live_123  '
    assert.equal(resolveApiKey(), 'adp_live_123')
  })
})
