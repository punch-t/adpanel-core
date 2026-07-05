import { afterEach, describe, expect, it } from 'vitest'

import { hasValidatedApiKey } from './client.js'

describe('hasValidatedApiKey', () => {
  const originalKey = process.env.ADPANEL_API_KEY

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ADPANEL_API_KEY
    else process.env.ADPANEL_API_KEY = originalKey
  })

  it('returns false when the key is unset', () => {
    delete process.env.ADPANEL_API_KEY
    expect(hasValidatedApiKey()).toBe(false)
  })

  it('returns false for every known placeholder value', () => {
    process.env.ADPANEL_API_KEY = 'your_adpanel_key_here'
    expect(hasValidatedApiKey()).toBe(false)

    process.env.ADPANEL_API_KEY = ''
    expect(hasValidatedApiKey()).toBe(false)
  })

  it('returns true for a real-looking key', () => {
    process.env.ADPANEL_API_KEY = 'adp_live_abc123'
    expect(hasValidatedApiKey()).toBe(true)
  })
})
