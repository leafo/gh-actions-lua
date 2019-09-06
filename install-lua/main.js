
const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require('@actions/io')
const tc = require('@actions/tool-cache')


const INSTALL_PREFIX = ".install"

async function main() {
  const luaVersion = core.getInput('luaVersion', {required: true})

  const luaInstallPath = `${INSTALL_PREFIX}/lua-${luaVersion}`

  // await exec.exec("sudo apt-get install libreadline-dev")

  const luaSourceTar = await tc.downloadTool(`http://www.lua.org/ftp/lua-${luaVersion}.tar.gz`)
  console.log(`source tar: ${luaSourceTar}`)

  await io.mkdirP(luaInstallPath)
  const luaPath = await tc.extractTar(luaSourceTar, luaInstallPath)
  console.log(`extract path: ${luaPath}`)
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})

// mkdir -p .install
// LUA_INSTALL_DIR="$(pwd)/.lua"
// mkdir -p "$LUA_INSTALL_DIR"
// cd .install
// curl http://www.lua.org/ftp/lua-${{ matrix.lua_version }}.tar.gz | tar xz
// cd lua-${{ matrix.lua_version }}
// make -j linux
// make -j INSTALL_TOP="$LUA_INSTALL_DIR" install;

core.warning("this is a warning..HELLO");



