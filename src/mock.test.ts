import { describe, expect, it } from 'vitest'

import { executeMockTool } from './mock.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('executeMockTool', () => {
  it('ingest returns a routingRef usable as orchestrate.brandMatrixRef (min 8 chars)', async () => {
    const result = await executeMockTool('adpanel_ingest_brand_matrix', {})
    expect(result.routingRef).toBeDefined()
    expect(result.routingRef!.length).toBeGreaterThanOrEqual(8)
  })

  it('orchestrate returns a valid UUID sessionId and a timelineRef (min 8 chars)', async () => {
    const result = await executeMockTool('adpanel_orchestrate_cinematic_timeline', {})
    expect(result.sessionId).toMatch(UUID_RE)
    expect(result.timelineRef).toBeDefined()
    expect(result.timelineRef!.length).toBeGreaterThanOrEqual(8)
  })

  it('orchestrate echoes back a sessionId passed in, so callers can chain multiple orchestration calls', async () => {
    const existing = '11111111-1111-4111-8111-111111111111'
    const result = await executeMockTool('adpanel_orchestrate_cinematic_timeline', {
      sessionId: existing,
    })
    expect(result.sessionId).toBe(existing)
  })

  it(
    'chains ingest -> orchestrate -> synthesize end to end with schema-valid refs',
    async () => {
      const ingest = await executeMockTool('adpanel_ingest_brand_matrix', {})
      const orchestrate = await executeMockTool('adpanel_orchestrate_cinematic_timeline', {
        brandMatrixRef: ingest.routingRef,
      })
      const synthesize = await executeMockTool('adpanel_synthesize_broadcast_asset', {
        sessionId: orchestrate.sessionId,
        timelineRef: orchestrate.timelineRef,
      })

      expect(ingest.routingRef!.length).toBeGreaterThanOrEqual(8)
      expect(orchestrate.sessionId).toMatch(UUID_RE)
      expect(orchestrate.timelineRef!.length).toBeGreaterThanOrEqual(8)
      expect(synthesize.mode).toBe('mock')
    },
    10_000
  )
})
