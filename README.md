# Github Action for Lua and LuaJIT

### `jkl1337/gh-actions-lua`

[![Actions Status](https://github.com/jkl1337/gh-actions-lua/workflows/test/badge.svg)](https://github.com/jkl1337/gh-actions-lua/actions)

**Note**: You must use version 8 or greater as GitHub has
deprecated older versions of the actions core libraries.

Builds and installs Lua into the `.lua/` directory in the working directory.
Adds the `.lua/bin` to the `PATH` environment variable so `lua` can be called
directly in workflows.

Other Lua GitHub actions:

* [`jkl1337/gh-actions-luarocks`](https://github.com/jkl1337/gh-actions-luarocks)
  * inputs: `luarocksVersion`


## Usage

Install Lua: (Will typically default to the latest release, 5.4.4 as of this readme)

```yaml
- uses: jkl1337/gh-actions-lua@v10
```

Install specific version of Lua:

```yaml
- uses: jkl1337/gh-actions-lua@v10
  with:
    luaVersion: "5.1.5"
```

Install specific version of LuaJIT:

```yaml
- uses: jkl1337/gh-actions-lua@v10
  with:
    luaVersion: "luajit-2.1.0-beta3"
```

When using Windows the following prerequisite action must be run before
building Lua: [`ilammy/msvc-dev-cmd@v1`](https://github.com/ilammy/msvc-dev-cmd). It is safe to
include this line on non-Windows platforms, as the action will do nothing in those cases.

```yaml
- uses: ilammy/msvc-dev-cmd@v1
- uses: jkl1337/gh-actions-lua@v10
```

## Inputs

### `luaVersion`

**Default**: `"5.4"`

Specifies the version of Lua to install. The version name instructs the action
where to download the source from.

Examples of versions:

* `"5.1.5"`
* `"5.2.4"`
* `"5.3.5"`
* `"5.4.1"`
* `"luajit-2.0.5"`
* `"luajit-2.1.0-beta3"`
* `"luajit-openresty"`

The version specifies where the source is downloaded from:

* `luajit-openresty` — will allways pull master from  https://github.com/openresty/luajit2
* Anything starting with `luajit-` — from http://luajit.org/download.html
* Anything else — from https://www.lua.org/ftp/

**Version aliases**

You can use shorthand `5.1`, `5.2`, `5.3`, `5.4`, `luajit` version aliases to point to the
latest (or recent) version of Lua for that version.

### `luaCompileFlags`

**Default**: `""`

Additional flags to pass to `make` when building Lua.

Example value:

```yaml
- uses: jkl1337/gh-actions-lua@master
  with:
    luaVersion: 5.3
    luaCompileFlags: LUA_CFLAGS="-DLUA_INT_TYPE=LUA_INT_INT"
```

> Note that compile flags may work differently across Lua and LuaJIT.

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

    - uses: jkl1337/gh-actions-lua@v10
      with:
        luaVersion: "5.1.5"

    - uses: jkl1337/gh-actions-luarocks@v4

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
    - uses: jkl1337/gh-actions-lua@v10
      with:
        luaVersion: ${{ matrix.luaVersion }}

    # ...
```
