# Github Action for Lua and LuaJIT

### `leafo/gh-actions-lua`

[![Actions Status](https://github.com/leafo/gh-actions-lua/workflows/test/badge.svg)](https://github.com/leafo/gh-actions-lua/actions)

Builds and installs Lua into the `.lua/` directory in the working directory.
Adds the `.lua/bin` to the `PATH` environment variable so `lua` can be called
directly in workflows.

Other Lua GitHub actions:

* [`leafo/gh-actions-luarocks`](https://github.com/leafo/gh-actions-luarocks)
  * inputs: `luarocksVersion`

## Usage

Install Lua: (Will typically default to the latest release, 5.3.5 as of this readme)

```yaml
- uses: leafo/gh-actions-lua@v3
```

Install specific version of Lua:

```yaml
- uses: leafo/gh-actions-lua@v3
  with:
    luaVersion: "5.1.5"
```

Install specific version of LuaJIT:

```yaml
- uses: leafo/gh-actions-lua@v3
  with:
    luaVersion: "luajit-2.1.0-beta3"
```

## Inputs

### `luaVersion`

**Default**: `"5.3"`

Specifies the version of Lua to install. The version name instructs the action
where to download the source from.

Examples of versions:

* `"5.1.5"`
* `"5.2.4"`
* `"5.3.5"`
* `"luajit-2.0.5"`
* `"luajit-2.1.0-beta3"`
* `"luajit-openresty"`

The version specifies where the source is downloaded from:

* `luajit-openresty` — from https://github.com/openresty/luajit2
* Anything starting with `luajit-` — from http://luajit.org/download.html
* Anything else — from https://www.lua.org/ftp/

**Version aliases**

You can use shorthand `5.1`, `5.2`, `5.3`, `luajit` version aliases to point to the
latest (or recent) version of Lua for that version.

## Full Example

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

    - uses: leafo/gh-actions-lua@v3
      with:
        luaVersion: "5.1.5"

    - uses: leafo/gh-actions-luarocks@v2

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
    - uses: leafo/gh-actions-lua@v3
      with:
        luaVersion: ${{ matrix.luaVersion }}

    # ...
```
