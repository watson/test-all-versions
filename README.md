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
  commands: node test/mysql/*.js
pg:
  versions: "*"
  commands:
    - node test/pg1.js
    - node test/pg2.js
```

## License

MIT
