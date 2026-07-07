/**
 * Abstract HTTP routing layer for AdPanel Core.
 * Forwards validated tool payloads to the remote production gateway.
 * No proprietary logic — transport and envelope only.
 */

const GATEWAY_ORIGIN = 'https://adpanel.io'
const GATEWAY_PATH = '/api/core/v1/gateway'
const GATEWAY_TIMEOUT_MS = 30_000

export type GatewayToolName =
  | 'adpanel_ingest_brand_matrix'
  | 'adpanel_orchestrate_cinematic_timeline'
  | 'adpanel_synthesize_broadcast_asset'

export type GatewayRequestEnvelope<T extends Record<string, unknown> = Record<string, unknown>> =
  {
    tool: GatewayToolName
    arguments: T
    client: {
      name: 'adpanel-core'
      version: string
    }
  }

export type GatewayResponseEnvelope = {
  ok: boolean
  sessionId?: string
  routingRef?: string
  [key: string]: unknown
}

const PLACEHOLDER_KEYS = new Set(['', 'your_adpanel_key_here'])

export function hasValidatedApiKey(): boolean {
  const raw = process.env.ADPANEL_API_KEY?.trim()
  if (!raw || PLACEHOLDER_KEYS.has(raw)) return false
  return true
}

export function resolveApiKey(): string {
  const apiKey = process.env.ADPANEL_API_KEY?.trim()
  if (!apiKey || PLACEHOLDER_KEYS.has(apiKey)) {
    throw new Error(
      'ADPANEL_API_KEY is not configured. Set it in your environment or use mock mode (omit the key).'
    )
  }
  return apiKey
}

export async function postToolRequest<T extends Record<string, unknown>>(
  tool: GatewayToolName,
  args: T,
  clientVersion: string
): Promise<GatewayResponseEnvelope> {
  const apiKey = resolveApiKey()

  const envelope: GatewayRequestEnvelope<T> = {
    tool,
    arguments: args,
    client: {
      name: 'adpanel-core',
      version: clientVersion,
    },
  }

  let response: Response
  try {
    response = await fetch(`${GATEWAY_ORIGIN}${GATEWAY_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`Gateway request to ${GATEWAY_PATH} timed out after ${GATEWAY_TIMEOUT_MS}ms`)
    }
    throw error
  }

  const payload = (await response.json().catch(() => ({}))) as GatewayResponseEnvelope & {
    error?: string
    message?: string
  }

  if (!response.ok) {
    throw new Error(
      payload.message || payload.error || `Gateway request failed (${response.status})`
    )
  }

  return payload
}
