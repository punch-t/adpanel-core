# Changelog

## Unreleased

### Added — resilient gateway calls (`src/client.ts`)

The gateway request now tolerates transient failures instead of a single bare `fetch`:

- **Per-request timeout** via `AbortController` (default 30s, override with `ADPANEL_TIMEOUT_MS`).
- **Bounded retries** on network errors, timeouts, HTTP 429 and 5xx, with exponential backoff
  that honours a `Retry-After` header (default 2, override with `ADPANEL_MAX_RETRIES`).
- **Fail-fast on 4xx** client errors — retrying them would never succeed.
- **Stable `Idempotency-Key`** header per call, so a retried POST is safe for the gateway to
  de-duplicate.

Backward-compatible: no tool names, input schemas, or response shapes changed — only the
transport was hardened. Both new environment variables are optional.
