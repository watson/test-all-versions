# test-all-versions

Run your test suite against all published versions of a given
dependency.

[![Build status](https://travis-ci.org/watson/test-all-versions.svg?branch=master)](https://travis-ci.org/watson/test-all-versions)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Usage

Use the `tav` command to run the tests:

```
$ tav <module> <semver> <command> [args...]
```

Example running `node test.js` against all versions of the mysql module
that satisfies the `^2.0.0` semver:

```
tav mysql ^2.0.0 node test.js
```

## License

MIT
