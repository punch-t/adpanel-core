/**
 * Local mock router — simulates gateway orchestration when ADPANEL_API_KEY is absent.
 * Diagnostics go to stderr only (stdio MCP transport owns stdout).
 */

import { randomUUID } from 'node:crypto'

import type { GatewayToolName } from './client.js'

const MOCK_DELAY_MS = 1500

export type MockExecutionResult = {
  mode: 'mock'
  sessionHash: string
  tool: GatewayToolName
  status: 'simulated_complete' | 'processing' | 'completed' | 'failed'
  message: string
  progress?: number
  resultUrl?: string
}

function writeStatus(lines: string[]): void {
  const trace = ['### AdPanel Core — mock orchestration', '', ...lines, ''].join('\n')
  process.stderr.write(`${trace}\n`)
}

function mockStepsForTool(tool: GatewayToolName): string[] {
  switch (tool) {
    case 'adpanel_ingest_brand_matrix':
      return [
        '- **[1/4]** Validating brand matrix envelope…',
        '- **[2/4]** Normalizing source asset references…',
        '- **[3/4]** Registering abstract routing session…',
        '- **[4/4]** Mock ingest complete — no remote gateway call made.',
      ]
    case 'adpanel_orchestrate_cinematic_timeline':
      return [
        '- **[1/4]** Resolving brand matrix routing ref…',
        '- **[2/4]** Building cinematic timeline scaffold…',
        '- **[3/4]** Scheduling orchestration phases (simulated)…',
        '- **[4/4]** Mock timeline orchestration complete.',
      ]
    case 'adpanel_synthesize_broadcast_asset':
      return [
        '- **[1/4]** Binding timeline routing ref…',
        '- **[2/4]** Preparing broadcast output envelope…',
        '- **[3/4]** Simulating synthesis pipeline handshake…',
        '- **[4/4]** Mock broadcast asset synthesis complete.',
      ]
    case 'adpanel_get_session_status':
      return [
        '- **[1/3]** Checking session routing registry…',
        '- **[2/3]** Retrieving rendering job state…',
        '- **[3/3]** Mock session status retrieval complete.',
      ]
    default:
      return ['- **[1/1]** Mock execution complete.']
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function executeMockTool<T extends Record<string, unknown>>(
  tool: GatewayToolName,
  _args: T
): Promise<MockExecutionResult> {
  const sessionHash = `mock_${randomUUID().replace(/-/g, '')}`

  writeStatus([
    `> Tool: \`${tool}\``,
    `> Session: \`${sessionHash}\``,
    '',
    ...mockStepsForTool(tool),
  ])

  await delay(MOCK_DELAY_MS)

  if (tool === 'adpanel_get_session_status') {
    const statuses = ['processing', 'completed'] as const
    const selectedStatus = statuses[Math.floor(Math.random() * statuses.length)]
    const progress = selectedStatus === 'completed' ? 100 : 75

    return {
      mode: 'mock',
      sessionHash,
      tool,
      status: selectedStatus,
      message: `Mock execution finished. Set ADPANEL_API_KEY to route this tool to the AdPanel production gateway. Current simulated status: ${selectedStatus}.`,
      progress,
      ...(selectedStatus === 'completed' && {
        resultUrl: 'https://assets.adpanel.io/mock_output_1080p.mp4',
      }),
    }
  }

  return {
    mode: 'mock',
    sessionHash,
    tool,
    status: 'simulated_complete',
    message:
      'Mock execution finished. Set ADPANEL_API_KEY to route this tool to the AdPanel production gateway.',
  }
}
