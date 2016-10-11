#!/usr/bin/env node
'use strict'

var exec = require('child_process').exec
var fs = require('fs')
var isCI = require('is-ci')
var yaml = require('yaml')
var once = require('once')
var pkgVersions = require('npm-package-versions')
var semver = require('semver')
var install = require('spawn-npm-install')
var argv = require('minimist')(process.argv.slice(2))

process.env.PATH = 'node_modules' + require('path').sep + '.bin:' + process.env.PATH

var tests = []
var currentlyInstalled // a string containing the latest installed module (format: name@version)

if (argv.help) {
  console.log('Usage: tav [options] [<module> <semver> <command> [args...]]')
  console.log()
  console.log('Options:')
  console.log('  --help       show this help')
  console.log('  -q, --quiet  don\'t output stdout from tests unless an error occors')
  console.log('  --ci         only run on CI servers when using .tav.yml file')
  process.exit()
}

if (argv._.length === 0) {
  loadYaml()
} else {
  tests.push([
    argv._.shift(),    // module name
    argv._.shift(),    // module semver
    [argv._.join(' ')] // test command
  ])
}

runTests()

function loadYaml () {
  var conf = yaml.eval(fs.readFileSync('.tav.yml').toString())

  Object.keys(conf).map(function (name) {
    var m = conf[name]
    var cmds = Array.isArray(m.commands) ? m.commands : [m.commands]
    tests.push([name, m.versions, cmds])
  })
}

function runTests (err) {
  if (argv.ci && !isCI) return
  if (err || tests.length === 0) return done(err)
  var args = tests.pop()
  args.push(runTests)
  test.apply(null, args)
}

function test (name, moduleSemver, cmds, cb) {
  pkgVersions(name, function (err, versions) {
    if (err) return cb(err)

    versions = versions.filter(function (version) {
      return semver.satisfies(version, moduleSemver)
    })

    run()

    function run (err) {
      if (err || versions.length === 0) return cb(err)
      testVersion(name, versions.pop(), cmds, run)
    }
  })
}

function testVersion (name, version, cmds, cb) {
  var i = 0

  run()

  function run (err) {
    if (err || i === cmds.length) return cb(err)
    testCmd(name, version, cmds[i++], function (code) {
      if (code !== 0) {
        var err = new Error('Test exited with code ' + code)
        err.exitCode = code
        cb(err)
      }
      run()
    })
  }
}

function testCmd (name, version, cmd, cb) {
  name = name + '@' + version

  if (name !== currentlyInstalled) attemptInstall()
  else test()

  function attemptInstall (attempts) {
    if (!attempts) attempts = 1
    console.log('-- installing %s', name)
    currentlyInstalled = name

    var doneInstalling = once(function (err) {
      if (!err) return test()

      if (++attempts <= 10) {
        console.warn('-- error installing %s (%s) - retrying (%d/10)...', name, err.message, attempts)
        attemptInstall(attempts)
      } else {
        console.error('-- error installing %s - aborting!', name)
        console.error(err.stack)
        cb(err.code || 1)
      }
    })

    install(name, doneInstalling).on('error', doneInstalling)
  }

  function test () {
    console.log('-- running "%s" with %s', cmd, name)

    var cp = exec(cmd)
    cp.on('close', function (code) {
      if (code !== 0 && stdout) {
        console.log('-- detected failing test, flushing stdout...')
        console.log(stdout)
      }
      cb(code)
    })
    cp.on('error', function (err) {
      console.error('-- error running "%s" with %s', cmd, name)
      console.error(err.stack)
      cb(err.code || 1)
    })
    if (!argv.quiet && !argv.q) {
      cp.stdout.pipe(process.stdout)
    } else {
      // store output in case we needed if an error occurs
      var stdout = ''
      cp.stdout.on('data', function (chunk) {
        stdout += chunk
      })
    }
    cp.stderr.pipe(process.stderr)
  }
}

function done (err) {
  if (err) {
    console.log('-- fatal: ' + err.message)
    process.exit(err.exitCode || 1)
  }
  console.log('-- ok')
}
