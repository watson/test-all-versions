'use strict'

var spawn = require('child_process').spawn
var test = require('tape')

test('tests succeed', function (t) {
  var p = spawn('./index.js', ['roundround', '<=0.2.0', 'node', '-e', 'process.exit(0)'])
  p.on('close', function (code) {
    t.equal(code, 0)
    t.end()
  })
  p.stdout.pipe(process.stdout)
  p.stderr.pipe(process.stderr)
})

test('tests fail', function (t) {
  var p = spawn('./index.js', ['roundround', '<=0.2.0', 'node', '-e', 'process.exit(1)'])
  p.on('close', function (code) {
    t.equal(code, 1)
    t.end()
  })
  p.stdout.pipe(process.stdout)
  p.stderr.pipe(process.stderr)
})

test('invalid module', function (t) {
  var p = spawn('./index.js', ['test-all-versions-' + Date.now(), '^1.0.0', 'npm', 'test'])
  p.on('close', function (code) {
    t.equal(code, process.version.indexOf('v0.10.') === 0 ? 8 : 1)
    t.end()
  })
  p.stdout.pipe(process.stdout)
  p.stderr.pipe(process.stderr)
})
