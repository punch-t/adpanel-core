import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildMockResult, mockStepsForTool } from '../src/mock.js'
import type { GatewayToolName } from '../src/client.js'

const TOOLS: GatewayToolName[] = [
  'adpanel_ingest_brand_matrix',
  'adpanel_orchestrate_cinematic_timeline',
  'adpanel_synthesize_broadcast_asset',
]

describe('mockStepsForTool', () => {
  for (const tool of TOOLS) {
    it(`returns a non-empty step list for ${tool}`, () => {
      const steps = mockStepsForTool(tool)
      assert.ok(steps.length > 0)
      assert.ok(steps.every((s) => typeof s === 'string' && s.length > 0))
    })
  }
})

describe('buildMockResult', () => {
  it('builds a well-formed mock envelope', () => {
    const result = buildMockResult('adpanel_ingest_brand_matrix', 'mock_abc123')
    assert.deepEqual(result, {
      mode: 'mock',
      sessionHash: 'mock_abc123',
      tool: 'adpanel_ingest_brand_matrix',
      status: 'simulated_complete',
      message:
        'Mock execution finished. Set ADPANEL_API_KEY to route this tool to the AdPanel production gateway.',
    })
  })
})
