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
  // custom `is-it-weekend` test - start
  var range = '4.x || 6.x'
  var versionTest = semver.satisfies(process.version, range)

  t.plan(versionTest ? 15 : 14)

  var expected = [
    'pretest', 'b2f-a', 'posttest', 'pretest', 'b2f-b', 'posttest', // b2f@1.0.0
    '1.0.0',                    // 27mhz@1.0.1 peerDependency
    'patterns-a', 'patterns-b', // patterns@1.0.2
    'patterns-a', 'patterns-b', // patterns@0.0.1
    'roundround-a',             // roundround@0.2.0
    'roundround-a'              // roundround@0.1.0
  ]

  if (versionTest) {
    expected.unshift(function (line) {
      return semver.satisfies(line, range)
    })
  }
  // custom `is-it-weekend` test - end

  var cp = exec('./index.js')

  cp.on('close', function (code) {
    t.equal(code, 0)
  })

  cp.stdout.on('data', function (chunk) {
    var lines = chunk.toString().trim().split('\n').filter(function (line) {
      return line.indexOf('-- ') !== 0 // ignore output from tav it self
    })

    lines.forEach(function (line) {
      var result = expected.shift()
      if (typeof result === 'function') t.ok(result(line))
      else t.equal(line, result)
    })
  })

  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

test('missing versions', function (t) {
  process.chdir('./test/missing-versions')
  var found = false
  var cp = exec('../../index.js')
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
