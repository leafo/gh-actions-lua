
const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require("@actions/io")
const tc = require("@actions/tool-cache")

const path = require("path")

const INSTALL_PREFIX = ".install"
const LUA_PREFIX = ".lua"

async function main() {
  const luaVersion = core.getInput('luaVersion', {required: true})

  const luaExtractPath = path.join(INSTALL_PREFIX, `lua-${luaVersion}`)
  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)


  const luaSourceTar = await tc.downloadTool(`http://www.lua.org/ftp/lua-${luaVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, luaExtractPath)

  process.chdir(luaExtractPath)


  await exec.exec("sudo apt-get install libreadline-dev")
  await exec.exec("make -j linux")
  await exec.exec(`make -j INSTALL_TOP="${luaInstallPath}" install`)
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



