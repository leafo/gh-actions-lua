
const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require("@actions/io")
const tc = require("@actions/tool-cache")

const path = require("path")

const INSTALL_PREFIX = ".install"
const LUA_PREFIX = ".lua"

async function install_luajit_openresty() {
  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)
  const installPath = path.join(process.cwd(), INSTALL_PREFIX)

  await io.mkdirP(installPath)

  await exec.exec("git clone https://github.com/openresty/luajit2.git", undefined, {
    cwd: installPath
  })

  await exec.exec("make -j", undefined, {
    cwd: path.join(installPath, "luajit2")
  })

  await exec.exec(`make -j install PREFIX="${luaInstallPath}"`, undefined, {
    cwd: path.join(installPath, "luajit2")
  })

  core.addPath(path.join(luaInstallPath, "bin"));
}

async function main() {
  const luaVersion = core.getInput('luaVersion', { required: true })

  if (luaVersion == "luajit-openresty") {
    return await install_luajit_openresty()
  }

  const luaExtractPath = path.join(process.cwd(), INSTALL_PREFIX, `lua-${luaVersion}`)
  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)

  const luaSourceTar = await tc.downloadTool(`http://www.lua.org/ftp/lua-${luaVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, INSTALL_PREFIX)

  await exec.exec("sudo apt-get install -q libreadline-dev", undefined, {
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

