
const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require('@actions/io')
const tc = require('@actions/tool-cache')


const INSTALL_PREFIX = ".install"

const luaVersion = core.getInput('luaVersion', {required: true})

// await exec.exec("sudo apt-get install libreadline-dev")
await io.mkdirP(INSTALL_PREFIX)

const luaSourceTar = await tc.downloadTool(`http://www.lua.org/ftp/lua-${luaVersion}.tar.gz`)
console.log(`source tar: ${luaSourceTar}`)
const luaPath = await tc.extractTar(luaSourceTar, `${INSTALL_PREFIX}/lua-${luaVersion}`)
console.log(`extract path: ${luaPath}`)

// mkdir -p .install
// LUA_INSTALL_DIR="$(pwd)/.lua"
// mkdir -p "$LUA_INSTALL_DIR"
// cd .install
// curl http://www.lua.org/ftp/lua-${{ matrix.lua_version }}.tar.gz | tar xz
// cd lua-${{ matrix.lua_version }}
// make -j linux
// make -j INSTALL_TOP="$LUA_INSTALL_DIR" install;

core.warning("this is a warning..HELLO");



