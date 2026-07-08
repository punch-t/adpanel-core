/**
 * HTTP routing layer for AdPanel Core: forwards validated tool payloads to the
 * remote gateway with per-attempt timeouts and bounded retries.
 */

import { randomUUID } from 'node:crypto'

const GATEWAY_ORIGIN = 'https://adpanel.io'
const GATEWAY_PATH = '/api/core/v1/gateway'

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 2
const BACKOFF_BASE_MS = 500
const BACKOFF_CAP_MS = 8_000

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

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10)
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, BACKOFF_CAP_MS)
    }
  }
  return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_CAP_MS)
}

async function fetchWithTimeout(
  body: string,
  apiKey: string,
  idempotencyKey: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${GATEWAY_ORIGIN}${GATEWAY_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function postToolRequest<T extends Record<string, unknown>>(
  tool: GatewayToolName,
  args: T,
  clientVersion: string
): Promise<GatewayResponseEnvelope> {
  const apiKey = resolveApiKey()
  const timeoutMs = intFromEnv('ADPANEL_TIMEOUT_MS', DEFAULT_TIMEOUT_MS)
  const maxRetries = intFromEnv('ADPANEL_MAX_RETRIES', DEFAULT_MAX_RETRIES)

  const envelope: GatewayRequestEnvelope<T> = {
    tool,
    arguments: args,
    client: {
      name: 'adpanel-core',
      version: clientVersion,
    },
  }
  const body = JSON.stringify(envelope)
  const idempotencyKey = randomUUID() // stable across retries so a replay is de-dupable

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetchWithTimeout(body, apiKey, idempotencyKey, timeoutMs)
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError'
      lastError = new Error(
        timedOut
          ? `Gateway request timed out after ${timeoutMs}ms`
          : `Gateway request failed: ${err instanceof Error ? err.message : String(err)}`
      )
      if (attempt < maxRetries) {
        await delay(retryDelayMs(attempt, null))
        continue
      }
      throw lastError
    }

    const payload = (await response.json().catch(() => ({}))) as GatewayResponseEnvelope & {
      error?: string
      message?: string
    }

    if (response.ok) {
      return payload
    }

    const message =
      payload.message || payload.error || `Gateway request failed (${response.status})`

    // Retry transient statuses only; other 4xx won't recover on replay.
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      lastError = new Error(message)
      await delay(retryDelayMs(attempt, response.headers.get('retry-after')))
      continue
    }

    throw new Error(message)
  }

  throw lastError ?? new Error('Gateway request failed')
}
