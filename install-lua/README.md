# leafo/gh-actions-lua/install-lua

[![Actions Status](https://github.com/leafo/gh-actions-lua/workflows/test/badge.svg)](https://github.com/leafo/gh-actions-lua/actions)


Builds Lua and installs it into the `.lua/` directory in the working directory.
Adds the `.lua/bin` to the `PATH` environment variable so `lua` can be called
directly in workflows.

## Usage

Install Lua: (Will typically default to the latest release, 5.3.5 as of this readme)

```yaml
- uses: leafo/gh-actions-lua/install-lua@master
```

Install specific version of Lua:

```yaml
- uses: leafo/gh-actions-lua/install-lua@master
  with:
    luaVersion: "5.1.5"
```

Install specific version of LuaJIT:

```yaml
- uses: leafo/gh-actions-lua/install-lua@master
  with:
    luaVersion: "luajit-2.1.0-beta3"
```

## Inputs

### `luaVersion`

**Default**: `"5.3.5"`

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
* Anything starting with `luajit-` — versions on from http://luajit.org/download.html
* Anything else — version on https://www.lua.org/ftp/

