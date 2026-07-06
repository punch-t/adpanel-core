/**
 * Minimal, dependency-free .env loader.
 * Populates process.env from a local .env file WITHOUT overriding variables
 * that are already set in the environment. A missing file is a silent no-op,
 * so the published binary (configured via Claude Desktop `env`) is unaffected.
 */

import { readFileSync } from 'node:fs'

/** Parse the contents of a .env file into a plain key/value map. */
export function parseEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const unprefixed = line.startsWith('export ') ? line.slice(7).trimStart() : line
    const eq = unprefixed.indexOf('=')
    if (eq === -1) continue

    const key = unprefixed.slice(0, eq).trim()
    if (!key) continue

    let value = unprefixed.slice(eq + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }

    out[key] = value
  }

  return out
}

/**
 * Load `path` (default `.env`) into `env`, keeping any already-set values.
 * Returns the keys that were newly applied (useful for diagnostics/tests).
 */
export function loadEnvFile(
  path = '.env',
  env: NodeJS.ProcessEnv = process.env
): string[] {
  let contents: string
  try {
    contents = readFileSync(path, 'utf8')
  } catch {
    return [] // no .env file — nothing to load
  }

  const applied: string[] = []
  for (const [key, value] of Object.entries(parseEnv(contents))) {
    if (env[key] === undefined) {
      env[key] = value
      applied.push(key)
    }
  }

  return applied
}
