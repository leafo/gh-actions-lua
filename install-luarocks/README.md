# leafo/gh-actions-lua/install-lua

[![Actions Status](https://github.com/leafo/gh-actions-lua/workflows/test/badge.svg)](https://github.com/leafo/gh-actions-lua/actions)


Builds and intsalls LuaRocks from source into `.luarocks/` directory in the working directory. Configures `PATH`, `LUA_PATH`, and `LUA_CPATH` environment varibles to be able to use luarocks directly in workflows.

Depends on [`leafo/gh-actions-lua/install-lua`](https://github.com/leafo/gh-actions-lua/tree/master/install-lua) for a version of Lua.


For full example, see https://github.com/leafo/gh-actions-lua/blob/master/README.md

## Usage

Install Lua, then LuaRocks:

```yaml
- uses: leafo/gh-actions-lua/install-lua@master
- uses: leafo/gh-actions-lua/install-luarocks@master
```

## Inputs

### `luarocksVersion`

**Default**: `"3.2.0"`

Specifies which version of LuaRocks to install. Must be listed on https://luarocks.github.io/luarocks/releases/
