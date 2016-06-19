'use strict'

var exec = require('child_process').exec
var test = require('tape')

test('tests succeed', function (t) {
  var cp = exec('./index.js roundround "<=0.2.0" node -e "process.exit\\(0\\)"')
  cp.on('close', function (code) {
    t.equal(code, 0)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

test('tests fail', function (t) {
  var cp = exec('./index.js roundround "<=0.2.0" node -e "process.exit\\(1\\)"')
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
    t.equal(code, process.version.indexOf('v0.10.') === 0 ? 8 : 1)
    t.end()
  })
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})

test('yaml', function (t) {
  t.plan(7)

  var expected = [
    'patterns-a', 'patterns-b', // patterns@1.0.2
    'patterns-a', 'patterns-b', // patterns@0.0.1
    'roundround-a',             // roundround@0.2.0
    'roundround-a'              // roundround@0.1.0
  ]

  var cp = exec('./index.js')

  cp.on('close', function (code) {
    t.equal(code, 0)
  })

  cp.stdout.on('data', function (chunk) {
    var s = chunk.toString()
    if (s.indexOf('-- ') === 0) return // ignore output from tav it self
    t.equal(s.trim(), expected.shift())
  })

  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
})
