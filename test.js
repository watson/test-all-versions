'use strict'

const exec = require('child_process').exec
const semver = require('semver')
const test = require('tape')

const helpOptions = ['--help', '-h']
helpOptions.forEach(function (option) {
  test(`option ${option}`, function (t) {
    const cp = exec(`./index.js ${option}`)
    cp.stderr.on('data', function (chunk) {
      t.fail('should not output anything on STDERR')
    })
    processStdout(cp, function (code, lines) {
      t.strictEqual(code, 0, 'should exit with exit code 0')
      t.strictEqual(lines.length, 10, 'should output 10 lines')
      t.ok(lines[0].startsWith('Usage: tav'))
      t.ok(lines[9].startsWith('  --ci'))
      t.end()
    })
  })
})

test('tests succeed', function (t) {
  const cp = exec('./index.js roundround "<=0.2.0" -- node -e "process.exit\\(0\\)"')
  cp.on('close', function (code) {
    t.strictEqual(code, 0)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

test('tests fail', function (t) {
  const cp = exec('./index.js roundround "<=0.2.0" -- node -e "process.exit\\(1\\)"')
  cp.on('close', function (code) {
    t.strictEqual(code, 1)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

test('invalid module', function (t) {
  const cp = exec('./index.js test-all-versions-' + Date.now() + ' ^1.0.0 npm test')
  cp.on('close', function (code) {
    t.strictEqual(code, 1)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

test('yaml', function (t) {
  t.plan(27)

  const expected = [
    'expire-array@1.1.0: base64-emoji@2.0.0',
    'expire-array@1.0.0: base64-emoji@2.0.0',
    'expire-array@1.1.0: base64-emoji@1.0.0',
    'expire-array@1.0.0: base64-emoji@1.0.0',
    '//3', // after-all-results@2.0.0, c=3
    '1/2/', // after-all-results@2.0.0, a=1 b=2
    '//4', // after-all-results@2.0.0, c=4
    '1/2/4', // after-all-results@2.0.0, a=1 b=2 c=4
    '//3', // isobj@1.0.0, c=3
    '1/2/', // isobj@1.0.0, a=1 b=2
    'throttling-b', // throttling@1.0.1
    'throttling-a', // throttling@1.0.2
    'preinstall', 'pretest', 'b2f-a', 'posttest', 'pretest', 'b2f-b', 'posttest', // b2f@1.0.0
    '1.0.0', // 27mhz@1.0.1 peerDependency
    'patterns-a', 'patterns-b', // patterns@1.0.2
    'patterns-a', 'patterns-b', // patterns@0.0.1
    'roundround-a', // roundround@0.2.0
    'roundround-a' // roundround@0.1.0
  ]

  const cp = start()

  processStdout(cp, function (code, lines) {
    t.strictEqual(code, 0)
    lines.forEach(function (line) {
      t.strictEqual(line, expected.shift())
    })
  })
})

test('node version', function (t) {
  const range = '10.x || 12.x'
  const active = semver.satisfies(process.version, range)

  t.plan(active ? 2 : 1)

  process.chdir('./test/node-version')
  const cp = start('../../index.js')

  processStdout(cp, function (code, lines) {
    t.strictEqual(code, 0)
    lines.forEach(function (line) {
      if (!active) t.fail('this node version should not produce any output')
      t.ok(semver.satisfies(line, range))
    })
    process.chdir('../..')
  })
})

test('missing "versions" property', function (t) {
  process.chdir('./test/missing-versions')
  let found = false
  const cp = start('../../index.js', true)
  cp.stderr.on('data', function (chunk) {
    if (!found && /Error: Missing "versions" property for 27mhz/.test(chunk)) {
      found = true
    }
  })
  cp.on('close', function (code) {
    t.strictEqual(code, 1)
    t.ok(found)
    process.chdir('../..')
    t.end()
  })
})

test('array of test cases', function (t) {
  const expected = ['2.0.1', '2.0.0']
  t.plan(3)

  process.chdir('./test/array')
  const cp = start('../../index.js')

  processStdout(cp, function (code, lines) {
    t.strictEqual(code, 0)
    lines.forEach(function (line) {
      t.strictEqual(line, expected.shift())
    })
    process.chdir('../..')
  })
})

test('no matching versions', function (t) {
  let stderr = false

  process.chdir('./test/no-matching-versions')
  const cp = start('../../index.js', true)

  cp.stderr.on('data', function (chunk) {
    t.strictEqual(chunk, '-- no versions of strip-lines matching 123.123.123\n')
    stderr = true
  })
  processStdout(cp, function (code, lines) {
    t.strictEqual(code, 0, 'should exit with code 0')
    t.strictEqual(stderr, true, 'should output info on STDERR')
    t.strictEqual(lines.length, 0, 'should not run any commands')
    process.chdir('../..')
    t.end()
  })
})

function start (path, silence) {
  const cp = exec(path || './index.js')

  if (!silence) {
    cp.stdout.pipe(process.stdout)
    cp.stderr.pipe(process.stderr)
  }

  return cp
}

function processStdout (cp, cb) {
  let str = ''
  cp.stdout.on('data', function (chunk) {
    str += chunk
  })
  cp.on('close', function (code) {
    const lines = processChunk(str)
    cb(code, lines)
  })
}

function processChunk (chunk) {
  return chunk.toString().trim().split('\n').filter(function (line) {
    return line.indexOf('-- ') !== 0 // ignore output from tav it self
  })
}
