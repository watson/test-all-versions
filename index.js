#!/usr/bin/env node
'use strict'

var spawn = require('child_process').spawn
var pkgVersions = require('npm-package-versions')
var semver = require('semver')
var install = require('spawn-npm-install')

var args = process.argv.slice(2)
var moduleName = args.shift()
var moduleSemver = args.shift()
var cmd = args.shift()

process.env.PATH = 'node_modules' + require('path').sep + '.bin:' + process.env.PATH

pkgVersions(moduleName, function (err, versions) {
  if (err) throw err

  versions = versions.filter(function (version) {
    return semver.satisfies(version, moduleSemver)
  })

  run()

  function run () {
    if (versions.length === 0) return
    test(versions.pop(), function (code) {
      if (code !== 0) {
        process.exit(code)
      }
      run()
    })
  }
})

function test (version, cb) {
  var fullModuleName = moduleName + '@' + version

  console.log('-- installing %s', fullModuleName)

  install(fullModuleName, function (err) {
    if (err) return cb(err)

    console.log('-- running "%s %s" with %s', cmd, args.join(' '), fullModuleName)

    var p = spawn(cmd, args)
    p.on('close', cb)
    p.stdout.pipe(process.stdout)
    p.stderr.pipe(process.stderr)
  })
}
