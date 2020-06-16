#!/usr/bin/env node
'use strict'

const exec = require('child_process').exec
const execSync = require('child_process').execSync
const fs = require('fs')
const os = require('os')
const util = require('util')
const isCI = require('is-ci')
const yaml = require('js-yaml')
const once = require('once')
const merge = require('deepmerge')
const pkgVersions = require('npm-package-versions')
const parseEnvString = require('parse-env-string')
const semver = require('semver')
const afterAll = require('after-all-results')
const resolve = require('resolve')
const importFresh = require('import-fresh')
const install = require('spawn-npm-install')
const differ = require('ansi-diff-stream')
const cliSpinners = require('cli-spinners')
const which = require('which')
const argv = require('minimist')(process.argv.slice(2))

const npm5plus = semver.gte(execSync('npm -v', { encoding: 'utf-8' }).trim(), '5.0.0')

// in case npm ever gets installed as a dependency, make sure we always access
// it from it's original location
const npmCmd = which.sync(process.platform === 'win32' ? 'npm.cmd' : 'npm')

process.env.PATH = 'node_modules' + require('path').sep + '.bin:' + process.env.PATH

if (argv.help || argv.h) {
  console.log('Usage: tav [options] [<module> <semver> <command> [args...]]')
  console.log()
  console.log('Options:')
  console.log('  -h, --help   show this help')
  console.log('  -q, --quiet  don\'t output stdout from tests unless an error occors')
  console.log('  --verbose    output a lot of information while running')
  console.log('  --compat     output just module version compatibility - no errors')
  console.log('  --ci         only run on CI servers when using .tav.yml file')
  process.exit()
}

const tests = argv._.length === 0 ? getConfFromFile() : getConfFromArgs()

let log, verbose, spinner, logSymbols, diff
if (argv.compat) {
  logSymbols = require('log-symbols')
  // "hack" to make the spinner spin more
  log = verbose = function () { spinner && spinner() }
  diff = differ()
  diff.pipe(process.stdout)
} else {
  verbose = argv.verbose ? console.log.bind(console) : function () {}
  log = console.log.bind(console)
}

runTests()

function getConfFromFile () {
  return normalizeConf(loadYaml())
}

function getConfFromArgs () {
  return normalizeConf({
    [argv._.shift()]: { // module name
      versions: argv._.shift(), // module semver
      commands: argv._.join(' ') // test command
    }
  })
}

function loadYaml () {
  return yaml.safeLoad(fs.readFileSync('.tav.yml').toString())
}

function normalizeConf (conf) {
  const whitelist = process.env.TAV ? process.env.TAV.split(',') : null

  return flatten(Object.keys(conf)
    .filter(function (name) {
      // Only run selected test if TAV environment variable is used
      return whitelist ? whitelist.indexOf(name) !== -1 : true
    })
    .map(function (name) {
      const moduleConf = conf[name]
      const normalized = { name, env: moduleConf.jobs && moduleConf.env }
      normalized.jobs = moduleConf.jobs || toArray(moduleConf)
      return normalized
    })
    .map(function ({ name, env: globalEnv, jobs }) {
      return flatten(jobs
        .filter(job => !job.node || semver.satisfies(process.version, job.node))
        .map(job => {
          if (!job.versions) throw new Error(`Missing "versions" property for ${name}`)

          job.name = name
          job.commands = toArray(job.commands)
          job.peerDependencies = toArray(job.peerDependencies)

          return mergeEnvMatrix(globalEnv, job.env).map(env => {
            job.env = parseEnvString(env)
            return merge({}, job)
          })
        }))
    }))
}

function mergeEnvMatrix (globalEnv, localEnv) {
  globalEnv = toArray(globalEnv)
  if (globalEnv.length === 0) globalEnv.push('')
  localEnv = toArray(localEnv)
  if (localEnv.length === 0) localEnv.push('')

  const env = []

  for (const e1 of globalEnv) {
    for (const e2 of localEnv) {
      env.push(e1 + ' ' + e2)
    }
  }

  return env
}

function runTests (err) {
  if (argv.ci && !isCI) return
  if (err || tests.length === 0) return done(err)
  test(tests.pop(), runTests)
}

function test (opts, cb) {
  verbose('-- preparing test', opts)

  if (argv.compat) console.log('Testing compatibility with %s:', opts.name)

  pkgVersions(opts.name, function (err, versions) {
    if (err) return cb(err)

    verbose('-- available package versions:', versions.join(', '))

    versions = versions.filter(function (version) {
      return semver.satisfies(version, opts.versions)
    })

    verbose('-- package versions matching "%s":', opts.versions, versions.join(', '))

    if (versions.length === 0) {
      console.warn('-- no versions of %s matching %s', opts.name, opts.versions)
      cb() // TODO: Would be nicer if this was a proper error, but that would be a breaking change. Consider it for the next major
      return
    }

    run()

    function run (err) {
      if (err || versions.length === 0) return cb(err)
      const version = versions.pop()
      if (argv.compat) spinner = getSpinner(version)()
      testVersion(opts, version, function (err) {
        if (argv.compat) {
          spinner.done(!err)
          run()
        } else {
          run(err)
        }
      })
    }
  })
}

function testVersion (test, version, cb) {
  let cmdIndex = 0

  preinstall(function (err) {
    if (err) return cb(err)
    const packages = [].concat(test.peerDependencies, test.name + '@' + version)
    ensurePackages(packages, runNextCmd)
  })

  function runNextCmd (err) {
    if (err || cmdIndex === test.commands.length) return cb(err)

    pretest(function (err) {
      if (err) return cb(err)

      testCmd(test.name, version, test.commands[cmdIndex++], test.env, function (code) {
        if (code !== 0) {
          const err = new Error('Test exited with code ' + code)
          err.exitCode = code
          return cb(err)
        }
        posttest(runNextCmd)
      })
    })
  }

  function preinstall (cb) {
    if (!test.preinstall) return process.nextTick(cb)
    log('-- running preinstall "%s" for %s', test.preinstall, test.name)
    execute(test.preinstall, test.name, cb)
  }

  function pretest (cb) {
    if (!test.pretest) return process.nextTick(cb)
    log('-- running pretest "%s" for %s', test.pretest, test.name)
    execute(test.pretest, test.name, cb)
  }

  function posttest (cb) {
    if (!test.posttest) return process.nextTick(cb)
    log('-- running posttest "%s" for %s', test.posttest, test.name)
    execute(test.posttest, test.name, cb)
  }
}

function testCmd (name, version, cmd, env, cb) {
  log('-- running test "%s" with %s (env: %O)', cmd, name, env)
  const opts = { env: Object.assign({}, env, process.env) }
  execute(cmd, name + '@' + version, opts, cb)
}

function execute (cmd, name, opts, cb) {
  if (typeof opts === 'function') return execute(cmd, name, null, opts)

  let stdout = ''
  const cp = exec(cmd, opts)
  cp.on('close', function (code) {
    if (code !== 0) {
      log('-- detected failing command, flushing stdout...')
      log(stdout)
    }
    cb(code)
  })
  cp.on('error', function (err) {
    console.error('-- error running "%s" with %s', cmd, name)
    console.error(err.stack)
    cb(err.code || 1)
  })
  if (argv.compat) {
    // "hack" to make the spinner move
    cp.stdout.on('data', spinner)
    cp.stderr.on('data', spinner)
  } else {
    if (!argv.quiet && !argv.q) {
      cp.stdout.pipe(process.stdout)
    } else {
      // store output in case we needed if an error occurs
      cp.stdout.on('data', function (chunk) {
        stdout += chunk
      })
    }
    cp.stderr.pipe(process.stderr)
  }
}

function ensurePackages (packages, cb) {
  log('-- required packages %j', packages)

  if (npm5plus) {
    // npm5 will uninstall everything that's not in the local package.json and
    // not in the install string. This might make tests fail. So if we detect
    // npm5, we just force install everything all the time.
    attemptInstall(packages, cb)
    return
  }

  const next = afterAll(function (_, packages) {
    packages = packages.filter(function (pkg) { return !!pkg })
    if (packages.length > 0) attemptInstall(packages, cb)
    else cb()
  })

  packages.forEach(function (dependency) {
    const done = next()
    const parts = dependency.split('@')
    const name = parts[0]
    const version = parts[1]

    verbose('-- resolving %s/package.json in %s', name, process.cwd())

    resolve(name + '/package.json', { basedir: process.cwd() }, function (err, pkg) {
      const installedVersion = err ? null : importFresh(pkg).version

      verbose('-- installed version:', installedVersion)

      if (installedVersion && semver.satisfies(installedVersion, version)) {
        log('-- reusing already installed %s', dependency)
        done()
        return
      }

      done(null, dependency)
    })
  })
}

function attemptInstall (packages, attempts, cb) {
  if (typeof attempts === 'function') return attemptInstall(packages, 1, attempts)

  log('-- installing %j', packages)

  const done = once(function (err) {
    clearTimeout(timeout)

    if (!err) return cb()

    if (++attempts <= 10) {
      console.warn('-- error installing %j (%s) - retrying (%d/10)...', packages, err.message, attempts)
      attemptInstall(packages, attempts, cb)
    } else {
      console.error('-- error installing %j - aborting!', packages)
      console.error(err.stack)
      cb(err.code || 1)
    }
  })

  const opts = { noSave: true, command: npmCmd }
  if (argv.verbose) opts.stdio = 'inherit'

  // npm on Travis have a tendency to hang every once in a while
  // (https://twitter.com/wa7son/status/1006859826549477378). We'll use a
  // timeout to abort and retry the install in case it hasn't finished within 2
  // minutes.
  const timeout = setTimeout(function () {
    done(new Error('npm install took too long'))
  }, 2 * 60 * 1000)

  install(packages, opts, done).on('error', done)
}

function getSpinner (str) {
  const frames = cliSpinners.dots.frames
  let i = 0
  const spin = function () {
    if (spin.isDone) return spin
    diff.write(util.format('%s %s', frames[i++ % frames.length], str))
    return spin
  }
  spin.done = function (sucess) {
    diff.write(util.format('%s %s', sucess ? logSymbols.success : logSymbols.error, str))
    diff.reset()
    spin.isDone = true
    process.stdout.write(os.EOL)
  }
  return spin
}

function done (err) {
  if (err) {
    log('-- fatal: ' + err.message)
    process.exit(err.exitCode || 1)
  }
  log('-- ok')
}

function toArray (obj) {
  return Array.isArray(obj)
    ? obj
    : (obj == null ? [] : [obj])
}

function flatten (arr) {
  return Array.prototype.concat.apply([], arr)
}
