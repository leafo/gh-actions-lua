# Github Actions for Lua

[![Actions Status](https://github.com/leafo/gh-actions-lua/workflows/test/badge.svg)](https://github.com/leafo/gh-actions-lua/actions)


These are a collection of GitHub actions for working with Lua and LuaRocks for CI/CD.

* [`leafo/gh-actions-lua/install-lua`](https://github.com/leafo/gh-actions-lua/tree/master/install-lua)
  * inputs: `luaVersion`
* [`leafo/gh-actions-lua/install-luarocks`](https://github.com/leafo/gh-actions-lua/tree/master/install-luarocks)
  * inputs: `luarocksVersion`

## Example

This example is for running tests on a Lua module that uses LuaRocks for
dependencies and [busted](https://olivinelabs.com/busted/) for a test suite.

Create `.github/workflows/test.yml` in your repository:

```yaml
name: test

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@master

    - uses: leafo/gh-actions-lua/install-lua@master
      with:
        luaVersion: "5.1.5"

    - uses: leafo/gh-actions-lua/install-luarocks@master

    - name: build
      run: |
        luarocks install busted
        luarocks make

    - name: test
      run: |
        busted -o utfTerminal
```

This example:

* Uses Lua 5.1.5 — You can use another version by chaning the `luaVersion` varible. LuaJIT versions can be used by prefixing the version with `luajit-`, i.e. `luajit-2.1.0-beta3`
* Uses a `.rockspec` file the root directory of your repository to install dependencies and test packaging the module via `luarocks make`


View the documentation for the individual actions (linked above) to learn more about how they work.

### Version build matrix

You can test against multiple versions of Lua using a matrix strategy:

```yaml
jobs:
  test:
    strategy:
      matrix:
        luaVersion: ["5.1.5", "5.2.4", "luajit-2.1.0-beta3"]

    steps:
    - uses: actions/checkout@master
    - uses: leafo/gh-actions-lua/install-lua@master
      with:
        luaVersion: ${{ matrix.luaVersion }}

    # ...
```


