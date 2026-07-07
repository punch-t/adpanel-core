/**
 * Minimal, dependency-free `.env` loader.
 *
 * The README instructs users to copy `.env.example` to `.env` and set their
 * API key there, so we load that file on startup. Values already present in
 * `process.env` are never overwritten — this keeps host-provided configuration
 * (e.g. the `env` block in a Claude Desktop MCP entry) authoritative.
 */

import { readFileSync } from 'node:fs'

/** Parse the contents of a `.env` file into key/value pairs. */
export function parseEnv(contents: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    if (!key) continue

    let value = line.slice(eq + 1).trim()
    // Strip a single layer of matching surrounding quotes.
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  return result
}

/**
 * Load variables from a `.env` file into `process.env` without overriding any
 * value that is already set. Missing or unreadable files are ignored so the
 * server still starts (e.g. in mock mode) when no `.env` is present.
 */
export function loadEnvFile(path = '.env'): void {
  let contents: string
  try {
    contents = readFileSync(path, 'utf8')
  } catch {
    return
  }

  for (const [key, value] of Object.entries(parseEnv(contents))) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}
