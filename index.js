#!/usr/bin/env node
'use strict'

var exec = require('child_process').exec
var fs = require('fs')
var isCI = require('is-ci')
var yaml = require('js-yaml')
var once = require('once')
var pkgVersions = require('npm-package-versions')
var semver = require('semver')
var afterAll = require('after-all')
var install = require('spawn-npm-install')
var argv = require('minimist')(process.argv.slice(2))

process.env.PATH = 'node_modules' + require('path').sep + '.bin:' + process.env.PATH

var tests = []

if (argv.help || argv.h) {
  console.log('Usage: tav [options] [<module> <semver> <command> [args...]]')
  console.log()
  console.log('Options:')
  console.log('  -h, --help   show this help')
  console.log('  -q, --quiet  don\'t output stdout from tests unless an error occors')
  console.log('  --ci         only run on CI servers when using .tav.yml file')
  process.exit()
}

if (argv._.length === 0) {
  loadYaml()
} else {
  tests.push([
    argv._.shift(),     // module name
    argv._.shift(),     // module semver
    [argv._.join(' ')], // test command
    []                  // peerDependencies not supported from command line
  ])
}

runTests()

function loadYaml () {
  var conf = yaml.safeLoad(fs.readFileSync('.tav.yml').toString())

  Object.keys(conf).map(function (name) {
    var m = conf[name]
    if (m.node && !semver.satisfies(process.version, m.node)) return
    var cmds = Array.isArray(m.commands) ? m.commands : [m.commands]
    var peerDependencies = m.peerDependencies
      ? Array.isArray(m.peerDependencies) ? m.peerDependencies : [m.peerDependencies]
      : []
    tests.push([name, m.versions, cmds, peerDependencies])
  })
}

function runTests (err) {
  if (argv.ci && !isCI) return
  if (err || tests.length === 0) return done(err)
  var args = tests.pop()
  args.push(runTests)
  test.apply(null, args)
}

function test (name, moduleSemver, cmds, peerDependencies, cb) {
  var next = afterAll(function (err) {
    if (err) return cb(err)

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
  })

  peerDependencies.forEach(function (peerDependency) {
    var parts = peerDependency.split('@')
    var name = parts[0]
    var version = parts[1]
    ensurePackage(name, version, 'peerDependency', next())
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
  ensurePackage(name, version, 'target', function (err) {
    if (err) return cb(err)

    name = name + '@' + version

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
  })
}

function ensurePackage (name, version, type, cb) {
  try {
    var installedVersion = require(name + '/package.json').version
  } catch (e) {}

  var installName = name + '@' + version

  if (installedVersion === version) {
    console.log('-- reusing already installed %s %s', type, installName)
    process.nextTick(cb)
    return
  }

  attemptInstall()

  function attemptInstall (attempts) {
    if (!attempts) attempts = 1
    console.log('-- installing %s %s', type, installName)

    var done = once(function (err) {
      if (!err) return cb()

      if (++attempts <= 10) {
        console.warn('-- error installing %s %s (%s) - retrying (%d/10)...', type, installName, err.message, attempts)
        attemptInstall(attempts)
      } else {
        console.error('-- error installing %s %s - aborting!', type, installName)
        console.error(err.stack)
        cb(err.code || 1)
      }
    })

    install(installName, done).on('error', done)
  }
}

function done (err) {
  if (err) {
    console.log('-- fatal: ' + err.message)
    process.exit(err.exitCode || 1)
  }
  console.log('-- ok')
}
