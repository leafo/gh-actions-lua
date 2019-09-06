
const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require("@actions/io")
const tc = require("@actions/tool-cache")

const path = require("path")

const INSTALL_PREFIX = ".install"
const LUA_PREFIX = ".lua"

async function main() {
  const luaVersion = core.getInput('luaVersion', { required: true })

  const luaExtractPath = path.join(process.cwd(), INSTALL_PREFIX, `lua-${luaVersion}`)
  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)

  const luaSourceTar = await tc.downloadTool(`http://www.lua.org/ftp/lua-${luaVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, INSTALL_PREFIX)

  await exec.exec("sudo apt-get install libreadline-dev -qq", undefined, {
    env: {
      DEBIAN_FRONTEND: "noninteractive",
      TERM: "linux"
    }
  })

  await exec.exec("make -j linux", undefined, {
    cwd: luaExtractPath
  })

  await exec.exec(`make -j INSTALL_TOP="${luaInstallPath}" install`, undefined, {
    cwd: luaExtractPath
  })

  core.addPath(path.join(luaInstallPath, "bin"));
}

main().catch(err => {
  core.setFailed(`Failed to install Lua: ${err}`);
})

