'use strict'

const exec = require('child_process').exec
const semver = require('semver')
const t = require('tap')

const TAP16 = semver.satisfies(require('tap/package.json').version, '16.x')

// Using a global test timeout because the "yaml" test needs extra time to run.
// For some reason setting `{ timeout: ... }` directly on the test doesn't have any effect
t.setTimeout(5 * 60 * 1000)

t.afterEach(function () {
  process.chdir(__dirname)
})

const helpOptions = ['--help', '-h']
helpOptions.forEach(function (option) {
  t.test(`option ${option}`, function (t) {
    const cp = exec(`./index.js ${option}`)
    cp.stderr.on('data', function (chunk) {
      t.fail('should not output anything on STDERR')
    })
    processStdout(cp, function (code, lines) {
      t.equal(code, 0, 'should exit with exit code 0')
      t.equal(lines.length, 10, 'should output 10 lines')
      t.ok(lines[0].startsWith('Usage: tav'))
      t.ok(lines[9].startsWith('  --ci'))
      t.end()
    })
  })
})

t.test('tests succeed', function (t) {
  const cp = exec('./index.js roundround "<=0.2.0" -- node -e "process.exit\\(0\\)"')
  cp.on('close', function (code) {
    t.equal(code, 0)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

t.test('tests fail', function (t) {
  const cp = exec('./index.js roundround "<=0.2.0" -- node -e "process.exit\\(1\\)"')
  cp.on('close', function (code) {
    t.equal(code, 1)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

t.test('invalid module', function (t) {
  const cp = exec('./index.js test-all-versions-' + Date.now() + ' ^1.0.0 npm test')
  cp.on('close', function (code) {
    t.equal(code, 1)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

t.test('yaml', function (t) {
  const cp = start()

  processStdout(cp, function (code, lines) {
    t.equal(code, 0)
    // TODO: Remove tap16 check when Node.js 14 support is dropped
    t[TAP16 ? 'strictSame' : 'matchOnlyStrict'](lines, [
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
    ])
    t.end()
  })
})

t.test('node version', function (t) {
  const range = '20.x || 21.x'
  const active = semver.satisfies(process.version, range)

  t.plan(active ? 2 : 1)

  process.chdir('./test/node-version')
  const cp = start('../../index.js')

  processStdout(cp, function (code, lines) {
    t.equal(code, 0)
    lines.forEach(function (line) {
      if (!active) t.fail('this node version should not produce any output')
      t.ok(semver.satisfies(line, range))
    })
  })
})

t.test('missing "versions" property', function (t) {
  process.chdir('./test/missing-versions')
  let found = false
  const cp = start('../../index.js', true)
  cp.stderr.on('data', function (chunk) {
    if (!found && /Error: Missing "versions" property for 27mhz/.test(chunk)) {
      found = true
    }
  })
  cp.on('close', function (code) {
    t.equal(code, 1)
    t.ok(found)
    t.end()
  })
})

t.test('array of test cases', function (t) {
  const expected = ['2.0.1', '2.0.0']
  t.plan(3)

  process.chdir('./test/array')
  const cp = start('../../index.js')

  processStdout(cp, function (code, lines) {
    t.equal(code, 0)
    lines.forEach(function (line) {
      t.equal(line, expected.shift())
    })
  })
})

t.test('no matching versions', function (t) {
  let stderr = false

  process.chdir('./test/no-matching-versions')
  const cp = start('../../index.js', true)

  cp.stderr.on('data', function (chunk) {
    t.equal(chunk, '-- fatal: No versions of strip-lines matching filter: 123.123.123\n')
    stderr = true
  })
  processStdout(cp, function (code, lines) {
    t.equal(code, 1, 'should exit with code 1')
    t.equal(stderr, true, 'should output info on STDERR')
    t.equal(lines.length, 0, 'should not run any commands')
    t.end()
  })
})

t.test('versions object', function (t) {
  const expected = [
    ...match('include: ~1.2.0', ['1.2.0', '1.2.1']),
    ...match('include: ~1.2.0, mode: all', ['1.2.0', '1.2.1']),
    ...match('include: ~1.0.0, exclude: 1.0.1 || 1.0.2', ['1.0.0', '1.0.3']),
    ...match('include: <=1.4.2, mode: latest-majors', ['0.0.0', '1.4.2']),
    ...match('include: <=1.4.2, mode: latest-minors', ['0.0.0', '1.0.3', '1.1.0', '1.2.1', '1.3.1', '1.4.2']),
    ...match('include: <=1.4.2, mode: max-2', ['0.0.0', '1.4.2']),
    ...match('include: <=1.4.2, mode: max-2-evenly', ['0.0.0', '1.4.2']),
    ...match('include: <=1.4.2, mode: max-5-evenly', ['0.0.0', '1.0.1', '1.2.0', '1.4.0', '1.4.2']),
    ...matchSemver('include: <=1.4.2, mode: max-2-random', 2, '<=1.4.2'),
    ...match('include: <=1.4.2, mode: max-2-latest', ['1.4.1', '1.4.2']),
    ...match('include: <=1.4.2, mode: max-2-popular', ['1.4.2', '1.4.1'])
  ].reverse()

  process.chdir('./test/versions-object')
  const cp = start('../../index.js')

  processStdout(cp, function (code, lines) {
    t.equal(code, 0)
    expected.forEach(function (expect, index) {
      if (typeof expect === 'string') {
        t.equal(lines[index], expect)
      } else if (typeof expect === 'function') {
        expect(t, lines[index])
      } else {
        t.fail(`Unknown type: ${typeof expect}`)
      }
    })
    t.end()
  })

  function match (prefix, versions) {
    return versions.map((v) => `${prefix}, gunzip-maybe@${v}`)
  }

  function matchSemver (prefix, total, expectedRange) {
    const regex = new RegExp(`^${prefix}, gunzip-maybe@(.+)$`)
    return new Array(total).fill((t, line) => {
      const result = line.match(regex)
      if (!result) return t.fail(`"${line}" doesn't match regex ${regex.toString()}`)
      t.ok(semver.satisfies(result[1], expectedRange))
    })
  }
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
  const trimmed = chunk.toString().trim()
  if (trimmed === '') return []

  return trimmed.split('\n').filter(function (line) {
    return line.indexOf('-- ') !== 0 // ignore output from tav it self
  })
}
