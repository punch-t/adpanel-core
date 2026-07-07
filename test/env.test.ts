import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadEnvFile, parseEnv } from '../src/env.js'

describe('parseEnv', () => {
  it('parses simple key/value pairs', () => {
    assert.deepEqual(parseEnv('FOO=bar\nBAZ=qux'), { FOO: 'bar', BAZ: 'qux' })
  })

  it('ignores blank lines and comments', () => {
    const input = '# comment\n\nFOO=bar\n   # indented comment\n'
    assert.deepEqual(parseEnv(input), { FOO: 'bar' })
  })

  it('strips a single layer of matching quotes', () => {
    assert.deepEqual(parseEnv('A="hello"\nB=\'world\''), { A: 'hello', B: 'world' })
  })

  it('keeps "=" characters inside the value', () => {
    assert.deepEqual(parseEnv('TOKEN=ab=cd=ef'), { TOKEN: 'ab=cd=ef' })
  })

  it('ignores lines without an "=" and empty keys', () => {
    assert.deepEqual(parseEnv('NOEQUALS\n=novalue\nOK=1'), { OK: '1' })
  })

  it('handles CRLF line endings', () => {
    assert.deepEqual(parseEnv('FOO=bar\r\nBAZ=qux\r\n'), { FOO: 'bar', BAZ: 'qux' })
  })
})

describe('loadEnvFile', () => {
  it('does not throw when the file is missing', () => {
    assert.doesNotThrow(() => loadEnvFile('./definitely-not-a-real-file.env'))
  })
})
