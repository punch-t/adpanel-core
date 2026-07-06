/**
 * Tests for the dependency-free .env loader: parsing rules and the
 * "don't override an already-set variable" precedence guarantee.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'

import { loadEnvFile, parseEnv } from './env.js'

const dir = mkdtempSync(join(tmpdir(), 'adpanel-env-'))
after(() => rmSync(dir, { recursive: true, force: true }))

function writeEnv(contents: string): string {
  const path = join(dir, `.env-${Math.random().toString(36).slice(2)}`)
  writeFileSync(path, contents)
  return path
}

describe('parseEnv', () => {
  it('parses simple key/value pairs', () => {
    assert.deepEqual(parseEnv('ADPANEL_API_KEY=adp_live'), {
      ADPANEL_API_KEY: 'adp_live',
    })
  })

  it('ignores blank lines and comments', () => {
    const parsed = parseEnv('# comment\n\nA=1\n   \n# another\nB=2')
    assert.deepEqual(parsed, { A: '1', B: '2' })
  })

  it('strips surrounding single and double quotes', () => {
    assert.deepEqual(parseEnv('A="hello world"\nB=\'x\''), {
      A: 'hello world',
      B: 'x',
    })
  })

  it('keeps "=" characters that appear in the value', () => {
    assert.deepEqual(parseEnv('TOKEN=a=b=c'), { TOKEN: 'a=b=c' })
  })

  it('supports an optional "export " prefix', () => {
    assert.deepEqual(parseEnv('export A=1'), { A: '1' })
  })
})

describe('loadEnvFile', () => {
  it('is a no-op when the file is missing', () => {
    const env: NodeJS.ProcessEnv = {}
    const applied = loadEnvFile(join(dir, 'does-not-exist'), env)
    assert.deepEqual(applied, [])
    assert.deepEqual(env, {})
  })

  it('applies values that are not already set', () => {
    const path = writeEnv('ADPANEL_API_KEY=adp_from_file\nADPANEL_TIMEOUT_MS=5000')
    const env: NodeJS.ProcessEnv = {}
    const applied = loadEnvFile(path, env)
    assert.deepEqual(applied.sort(), ['ADPANEL_API_KEY', 'ADPANEL_TIMEOUT_MS'])
    assert.equal(env.ADPANEL_API_KEY, 'adp_from_file')
    assert.equal(env.ADPANEL_TIMEOUT_MS, '5000')
  })

  it('does not override an already-set variable', () => {
    const path = writeEnv('ADPANEL_API_KEY=adp_from_file')
    const env: NodeJS.ProcessEnv = { ADPANEL_API_KEY: 'adp_from_real_env' }
    const applied = loadEnvFile(path, env)
    assert.deepEqual(applied, [])
    assert.equal(env.ADPANEL_API_KEY, 'adp_from_real_env')
  })
})
