import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { executeMockTool } from '../src/mock.js'

describe('executeMockTool', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves with a mock session result for a known tool', async () => {
    const resultPromise = executeMockTool('adpanel_ingest_brand_matrix', { brandName: 'Acme' })
    await vi.advanceTimersByTimeAsync(1500)
    const result = await resultPromise

    expect(result.mode).toBe('mock')
    expect(result.status).toBe('simulated_complete')
    expect(result.tool).toBe('adpanel_ingest_brand_matrix')
    expect(result.sessionHash).toMatch(/^mock_[0-9a-f]{32}$/)
  })

  it('writes the trace to stderr and never touches stdout', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const resultPromise = executeMockTool('adpanel_orchestrate_cinematic_timeline', {})
    await vi.advanceTimersByTimeAsync(1500)
    await resultPromise

    expect(stderrSpy).toHaveBeenCalled()
    expect(stdoutSpy).not.toHaveBeenCalled()

    const trace = stderrSpy.mock.calls.map((call) => call[0]).join('')
    expect(trace).toContain('adpanel_orchestrate_cinematic_timeline')
    expect(trace).toContain('Mock timeline orchestration complete')
  })

  it('falls back to a single generic step for an unrecognized tool name', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    // Cast bypasses the GatewayToolName union to exercise the default branch in mockStepsForTool.
    const resultPromise = executeMockTool('unknown_tool' as never, {})
    await vi.advanceTimersByTimeAsync(1500)
    await resultPromise

    const trace = stderrSpy.mock.calls.map((call) => call[0]).join('')
    expect(trace).toContain('Mock execution complete')
  })
})
