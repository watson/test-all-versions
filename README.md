# test-all-versions

Run your test suite against all published versions of a given
dependency.

[![Build status](https://travis-ci.org/watson/test-all-versions.svg?branch=master)](https://travis-ci.org/watson/test-all-versions)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Usage

Use the `tav` command to run the tests:

```
$ tav [options] [<module> <semver> <command> [args...]]
```

Example running `node test.js` against all versions of the mysql module
that satisfies the `^2.0.0` semver:

```
tav mysql ^2.0.0 node test.js
```

### options

- `--help` - Output usage info
- `--quiet` - Don't output stdout from tests unless an error occors
- `--verbose` - Output a lot of information while running
- `--compat` - Output just module version compatibility - no errors
- `--ci` - When running `tav` together with a `.tav.yml` file, use this
  argument to only run the tests on a CI server. This allows you to add
  `tav` to your `npm test` command without spending time running tav
  tests in development.

### .tav.yml

If `tav` is run without specifying a module, it will instead look for a
`.tav.yml` file in `cwd` and expect that to contain all its
configuration. This is similar to how Travis CI works with
`.travis.yml`.

The following is an example `.tav.yml` file that runs a subset of tests
against all versions of the `mysql` module that satisfies `^2.0.0` and
all versions of the `pg` module that satisfies `*`:

```yml
mysql:
  versions: ^2.0.0
  commands: tape test/mysql/*.js
pg:
  versions: "*"
  commands:
    - node test/pg1.js
    - node test/pg2.js
```

#### Node.js version

You can optionally specify a `node` key in case you want to limit which
verisons of Node.js the tests for a specific package runs under. The
value must be a valid semver range:

```yml
mysql:
  node: ">=1.0.0"
  versions: ^2.0.0
  commands: node test/mysql.js
```

#### Peer Dependencies

If a package or a test needs certain peer dependencies installed in
order to be able to run, use the `peerDependencies` key. The value can
be either a single value like shown below, or a list of values just like
with the `commands` key:

```yml
graphql-express:
  peerDependencies: graphql@0.9.2
  versions: ^0.6.1
  commands: node test/graphql-express.js
```

#### Setup and Teardown

If you need to run a script before or after a command, use the
`preinstall`, `pretest` and `posttest` keys:

```yml
graphql:
  versions: ^0.7.0
  preinstall: rm -fr node_modules/graphql-express
  commands: node test/graphql.js
```

#### Multiple test-groups per module

Normally the name of the module that should be installed is specified
using the root property names. This comes with the limitation that you
can only specify one test-group per module.

To get around this limitation, you can specify the module to install
using the optional `name` property:

```yml
mysql-test-1:
  name: mysql
  versions: ^1.0.0
  commands: node test/mysql-1x.js
mysql-test-2:
  name: mysql
  versions: ^2.0.0
  commands: node test/mysql-2x.js
```

#### Whitelist tests with environment variables

You can use the enironment variable `TAV` to limit which module from the
.`tav.yml` file to test:

`TAV=mysql`

This allows you to create a build-matrix on servers like Travis CI where
each module in your `.tav.yml` file is tests in an individual build. You
can also comma separate multiple names if needed:

`TAV=mysql,pg`

To see an example of this in action, check out the
[`.travis.yml`](https://github.com/opbeat/opbeat-node/blob/master/.travis.yml)
and
[`.tav.yml`](https://github.com/opbeat/opbeat-node/blob/master/.tav.yml)
files under the [opbeat module](https://github.com/opbeat/opbeat-node).

## License

MIT
