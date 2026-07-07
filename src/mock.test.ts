import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'

import { executeMockTool } from './mock.js'

describe('executeMockTool', () => {
  afterEach(() => {
    mock.reset()
  })

  it('returns a mock session result and writes its trace to stderr', async () => {
    const stderrWrite = mock.method(process.stderr, 'write', () => true)
    mock.timers.enable({ apis: ['setTimeout'] })

    const pending = executeMockTool('adpanel_ingest_brand_matrix', { brandName: 'Acme' })
    mock.timers.tick(1500)
    const result = await pending

    assert.equal(result.mode, 'mock')
    assert.equal(result.tool, 'adpanel_ingest_brand_matrix')
    assert.equal(result.status, 'simulated_complete')
    assert.match(result.sessionHash, /^mock_[a-f0-9]{32}$/)

    assert.ok(stderrWrite.mock.callCount() >= 1)
  })

  it('generates a distinct session hash per call', async () => {
    mock.method(process.stderr, 'write', () => true)
    mock.timers.enable({ apis: ['setTimeout'] })

    const firstPending = executeMockTool('adpanel_orchestrate_cinematic_timeline', {})
    mock.timers.tick(1500)
    const first = await firstPending

    const secondPending = executeMockTool('adpanel_orchestrate_cinematic_timeline', {})
    mock.timers.tick(1500)
    const second = await secondPending

    assert.notEqual(first.sessionHash, second.sessionHash)
  })
})
