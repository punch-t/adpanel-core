/**
 * Abstract HTTP routing layer for AdPanel Core.
 * Forwards validated tool payloads to the remote production gateway.
 * No proprietary logic — transport and envelope only.
 */

const GATEWAY_ORIGIN = 'https://adpanel.io'
const GATEWAY_PATH = '/api/core/v1/gateway'
const REQUEST_TIMEOUT_MS = 30_000

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

export type RuntimeStatus = {
  mode: 'mock' | 'gateway'
  apiKeyConfigured: boolean
  apiKeyPlaceholder: boolean
  gatewayOrigin: string
  gatewayReachable?: boolean
  gatewayProbeStatus?: number
  gatewayProbeError?: string
  requestTimeoutMs: number
}

type GatewayErrorPayload = {
  code?: string
  error?: string
  hint?: string
  message?: string
  details?: unknown
}

export class GatewayRequestError extends Error {
  code: string
  status?: number
  hint?: string
  details?: unknown

  constructor(message: string, options: { code: string; status?: number; hint?: string; details?: unknown; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'GatewayRequestError'
    this.code = options.code
    this.status = options.status
    this.hint = options.hint
    this.details = options.details
  }
}

const PLACEHOLDER_KEYS = new Set(['', 'your_adpanel_key_here'])

function isPlaceholderApiKey(raw: string | undefined): boolean {
  if (!raw) return true
  return PLACEHOLDER_KEYS.has(raw)
}

function formatGatewayErrorMessage(payload: GatewayErrorPayload, status: number): string {
  const baseMessage = payload.message || payload.error || `Gateway request failed (${status})`

  if (status === 401 || status === 403) {
    return `Gateway auth failed [auth_error/${status}]: ${baseMessage}. Hint: verify ADPANEL_API_KEY is valid and not a placeholder.`
  }

  if (status === 400 || status === 409 || status === 422) {
    return `Gateway validation failed [validation_error/${status}]: ${baseMessage}. Hint: review the tool arguments and any field-level validation errors.`
  }

  if (status === 429) {
    return `Gateway rate limited [rate_limited/${status}]: ${baseMessage}. Hint: retry after a short delay or reduce request volume.`
  }

  if (status >= 500) {
    return `Gateway server error [server_error/${status}]: ${baseMessage}. Hint: retry later or check AdPanel service status.`
  }

  return `Gateway request failed [gateway_error/${status}]: ${baseMessage}`
}

export function hasValidatedApiKey(): boolean {
  const raw = process.env.ADPANEL_API_KEY?.trim()
  if (isPlaceholderApiKey(raw)) return false
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

async function probeGatewayOrigin(): Promise<Pick<RuntimeStatus, 'gatewayReachable' | 'gatewayProbeStatus' | 'gatewayProbeError'>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(GATEWAY_ORIGIN, {
      method: 'HEAD',
      signal: controller.signal,
    })

    return {
      gatewayReachable: true,
      gatewayProbeStatus: response.status,
    }
  } catch (error) {
    return {
      gatewayReachable: false,
      gatewayProbeError: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function getRuntimeStatus(probeNetwork = true): Promise<RuntimeStatus> {
  const apiKey = process.env.ADPANEL_API_KEY?.trim()
  const apiKeyPlaceholder = isPlaceholderApiKey(apiKey)
  const status: RuntimeStatus = {
    mode: apiKeyPlaceholder ? 'mock' : 'gateway',
    apiKeyConfigured: !apiKeyPlaceholder,
    apiKeyPlaceholder,
    gatewayOrigin: GATEWAY_ORIGIN,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
  }

  if (!probeNetwork) {
    return status
  }

  return {
    ...status,
    ...(await probeGatewayOrigin()),
  }
}

export async function postToolRequest<T extends Record<string, unknown>>(
  tool: GatewayToolName,
  args: T,
  clientVersion: string
): Promise<GatewayResponseEnvelope> {
  const apiKey = resolveApiKey()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

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
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GatewayRequestError(
        `Gateway request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Hint: the gateway may be slow or unreachable.`,
        { code: 'timeout', hint: 'The gateway did not respond before the client timeout elapsed.', cause: error }
      )
    }
    throw new GatewayRequestError(
      `Gateway request failed [network_error]: ${error instanceof Error ? error.message : String(error)}. Hint: check network connectivity to ${GATEWAY_ORIGIN}.`,
      { code: 'network_error', hint: 'The request could not be sent to the gateway.', cause: error }
    )
  } finally {
    clearTimeout(timeoutId)
  }

  const payload = (await response.json().catch(() => ({}))) as GatewayResponseEnvelope &
    GatewayErrorPayload

  if (!response.ok) {
    const code =
      payload.code ||
      (response.status === 401 || response.status === 403
        ? 'auth_error'
        : response.status === 400 || response.status === 409 || response.status === 422
          ? 'validation_error'
          : response.status === 429
            ? 'rate_limited'
            : response.status >= 500
              ? 'server_error'
              : 'gateway_error')

    throw new GatewayRequestError(
      formatGatewayErrorMessage(payload, response.status),
      {
        code,
        status: response.status,
        hint: payload.hint,
        details: payload.details,
      }
    )
  }

  return payload
}
