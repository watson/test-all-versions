'use strict'

var exec = require('child_process').exec
var semver = require('semver')
var test = require('tape')

test('tests succeed', function (t) {
  var cp = exec('./index.js roundround "<=0.2.0" -- node -e "process.exit\\(0\\)"')
  cp.on('close', function (code) {
    t.equal(code, 0)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

test('tests fail', function (t) {
  var cp = exec('./index.js roundround "<=0.2.0" -- node -e "process.exit\\(1\\)"')
  cp.on('close', function (code) {
    t.equal(code, 1)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

test('invalid module', function (t) {
  var cp = exec('./index.js test-all-versions-' + Date.now() + ' ^1.0.0 npm test')
  cp.on('close', function (code) {
    t.equal(code, 1)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

test('yaml', function (t) {
  t.plan(14)

  var expected = [
    'pretest', 'b2f-a', 'posttest', 'pretest', 'b2f-b', 'posttest', // b2f@1.0.0
    '1.0.0', // 27mhz@1.0.1 peerDependency
    'patterns-a', 'patterns-b', // patterns@1.0.2
    'patterns-a', 'patterns-b', // patterns@0.0.1
    'roundround-a', // roundround@0.2.0
    'roundround-a' // roundround@0.1.0
  ]

  var cp = start()

  cp.on('close', function (code) {
    t.equal(code, 0)
  })

  cp.stdout.on('data', function (chunk) {
    processChunk(chunk).forEach(function (line) {
      t.equal(line, expected.shift())
    })
  })
})

test('node version', function (t) {
  var range = '4.x || 6.x'
  var active = semver.satisfies(process.version, range)

  t.plan(active ? 2 : 1)

  process.chdir('./test/node-version')
  var cp = start('../../index.js')

  cp.on('close', function (code) {
    t.equal(code, 0)
    process.chdir('../..')
  })

  cp.stdout.on('data', function (chunk) {
    processChunk(chunk).forEach(function (line) {
      if (!active) t.fail('this node version should not produce any output')
      t.ok(semver.satisfies(line, range))
    })
  })
})

test('missing versions', function (t) {
  process.chdir('./test/missing-versions')
  var found = false
  var cp = start('../../index.js', true)
  cp.stderr.on('data', function (chunk) {
    if (!found && /Error: Missing "versions" property for 27mhz/.test(chunk)) {
      found = true
    }
  })
  cp.on('close', function (code) {
    t.equal(code, semver.satisfies(process.version, '0.10.x') ? 8 : 1)
    t.ok(found)
    process.chdir('../..')
    t.end()
  })
})

test('custom name', function (t) {
  var expected = ['2.0.1', '2.0.0']
  t.plan(3)

  process.chdir('./test/custom-name')
  var cp = start('../../index.js')

  cp.on('close', function (code) {
    t.equal(code, 0)
    process.chdir('../..')
  })

  cp.stdout.on('data', function (chunk) {
    processChunk(chunk).forEach(function (line) {
      t.equal(line, expected.shift())
    })
  })
})

function start (path, silence) {
  var cp = exec(path || './index.js')

  if (!silence) {
    cp.stdout.pipe(process.stdout)
    cp.stderr.pipe(process.stderr)
  }

  return cp
}

function processChunk (chunk) {
  return chunk.toString().trim().split('\n').filter(function (line) {
    return line.indexOf('-- ') !== 0 // ignore output from tav it self
  })
}
