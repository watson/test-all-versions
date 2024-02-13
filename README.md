# test-all-versions

Run your test suite against all published versions of a given
dependency.

[![npm](https://img.shields.io/npm/v/test-all-versions.svg)](https://www.npmjs.com/package/test-all-versions)
[![codecov](https://codecov.io/gh/watson/test-all-versions/graph/badge.svg?token=AoH9k0Z4pb)](https://codecov.io/gh/watson/test-all-versions)
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

Usage:

- `preinstall`: runs before `npm install`
- `pretest`: runs before each command in the `commands` list
- `posttest`: runs after each comamnd in the `commands` list

#### Multiple test-groups per module

If you need multiple test-groups for the same module, use `-` to specify
an array of test-groups:

```yml
mysql:
  - versions: ^1.0.0
    commands: node test/mysql-1x.js
  - versions: ^2.0.0
    commands: node test/mysql-2x.js
```

#### Test matrix

If you specify environment variables using the `env` key, the test
commands will be run once per element in the `env` array. In the
following example `node test/mysql.js` will run twice for each version
matching `^2.0.0` - once with `MYSQL_HOST=server1.example.net
MYSQL_PWD=secret!` and once with `MYSQL_HOST=server2.example.net`.

```yml
mysql:
  env:
    - MYSQL_HOST=server1.example.net MYSQL_PWD=secret!
    - MYSQL_HOST=server2.example.net
  versions: ^2.0.0
  commands: node test/mysql.js
```

If more than one test-case is needed for a given module, the environment
variables can shared between them using the following syntax:

```yml
mysql:
  env:
    - MYSQL_HOST=server1.example.net MYSQL_PWD=secret!
    - MYSQL_HOST=server2.example.net
  jobs:
    - versions: ^1.0.0
      commands: node test/mysql-1x.js
    - versions: ^2.0.0
      commands: node test/mysql-2x.js
```

#### Advanced `versions` usage

The `versions` field takes two types of arguments:

- A string representing a semver-range (e.g. `^2.0.0`)
- An object with the following properties:
  - `include` (required): The semver-range to include in testing. Same effect as the `versions` string.
  - `exclude` (optional): The semver-range of versions to exclude. Versions matching this range would be removed from the `include` list if present.
  - `mode` (optional): The way you want to pick versions from the ones resolved based on `include`/`exclude`. Possible values are:
    - `all` (default): All versions matching the desired range.
    - `latest-majors`: Only pick the latest version of each major matching the desired range.
    - `latest-minors`: Only pick the latest version of each minor matching the desired range.
    - `max-{N}(-<algo>)`: Only pick `N` number of versions within the desired range, where `{N}` is a number larger than `2`. The optional `-<algo>` postfix can be used to specify the algorithm used for picking the versions inbetween. Possible algorithmes are:
      - `evenly` (default): Evenly space out which versions to pick, always including the first and last version in the desired range.
      - `random`: Pick `N` versions at random within the desired range.
      - `latest`: Pick the latest `N` versions within the desired range.
      - `popular`: Pick the `N` most popular versions based on last weeks download count from npm.

##### Exampels

Test all versions within `^1.0.0`, except `1.2.3`:

```yaml
mysql:
  versions:
    include: ^1.0.0
    exclude: 1.2.3
  commands: node test/mysql.js
```

Test 5 versions in the `^1.0.0` range (evenly spaced within the range):

```yaml
mysql:
  versions:
    include: ^1.0.0
    mode: max-5
  commands: node test/mysql.js
```

Test the 5 most popular versions in the `^1.0.0` range (based on download count within the last week):

```yaml
mysql:
  versions:
    include: ^1.0.0
    mode: max-5-popular
  commands: node test/mysql.js
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
[`.travis.yml`](https://github.com/elastic/apm-agent-nodejs/blob/4d28d248118f734a2b498895f6ac2622c65c85fe/.travis.yml#L104-L105)
and
[`.tav.yml`](https://github.com/elastic/apm-agent-nodejs/blob/master/.tav.yml)
files under the [Elastic APM Node.js Agent module](https://github.com/elastic/apm-agent-nodejs).

## License

[MIT](LICENSE)
