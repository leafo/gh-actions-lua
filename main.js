
const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require("@actions/io")
const tc = require("@actions/tool-cache")

const path = require("path")

const INSTALL_PREFIX = ".install"
const LUA_PREFIX = ".lua"

const VERSION_ALIASES = {
  "5.1": "5.1.5",
  "5.2": "5.2.4",
  "5.3": "5.3.5",
  "5.4": "5.4.1",
  "luajit": "luajit-2.1.0-beta3",
}

async function install_luajit_openresty() {
  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)
  const installPath = path.join(process.cwd(), INSTALL_PREFIX)

  await io.mkdirP(installPath)

  await exec.exec("git clone https://github.com/openresty/luajit2.git", undefined, {
    cwd: installPath
  })

  const macOSDeploymentTarget = process.platform === 'darwin' ? ' MACOSX_DEPLOYMENT_TARGET=10.15' : ''
  await exec.exec("make -j" + macOSDeploymentTarget, undefined, {
    cwd: path.join(installPath, "luajit2")
  })

  await exec.exec(`make -j install PREFIX="${luaInstallPath}"`, undefined, {
    cwd: path.join(installPath, "luajit2")
  })


  core.addPath(path.join(luaInstallPath, "bin"));

  await exec.exec("ln -s luajit lua", undefined, {
    cwd: path.join(luaInstallPath, "bin")
  })
}

async function install_luajit(luajitVersion) {
  const luaExtractPath = path.join(process.cwd(), INSTALL_PREFIX, `LuaJIT-${luajitVersion}`)
  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)

  const luaSourceTar = await tc.downloadTool(`https://luajit.org/download/LuaJIT-${luajitVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, INSTALL_PREFIX)

  const macOSDeploymentTarget = process.platform === 'darwin' ? ' MACOSX_DEPLOYMENT_TARGET=10.15' : ''
  await exec.exec("make -j" + macOSDeploymentTarget, undefined, {
    cwd: luaExtractPath
  })

  await exec.exec(`make -j install PREFIX="${luaInstallPath}"`, undefined, {
    cwd: luaExtractPath
  })

  core.addPath(path.join(luaInstallPath, "bin"));

  await exec.exec(`ln -s luajit-${luajitVersion} lua`, undefined, {
    cwd: path.join(luaInstallPath, "bin")
  })

}

async function main() {
  let luaVersion = core.getInput('luaVersion', { required: true })
  let luaCompileFlags = core.getInput('luaCompileFlags')

  if (VERSION_ALIASES[luaVersion]) {
    luaVersion = VERSION_ALIASES[luaVersion]
  }

  if (luaVersion == "luajit-openresty") {
    return await install_luajit_openresty()
  }

  if (luaVersion.startsWith("luajit-")) {
    const luajitVersion = luaVersion.substr("luajit-".length)
    return await install_luajit(luajitVersion)
  }

  const luaExtractPath = path.join(process.cwd(), INSTALL_PREFIX, `lua-${luaVersion}`)
  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)

  const luaSourceTar = await tc.downloadTool(`https://www.lua.org/ftp/lua-${luaVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, INSTALL_PREFIX)

  if (process.platform === 'darwin') {
    await exec.exec("brew install readline ncurses")
  } else {
    await exec.exec("sudo apt-get install -q libreadline-dev libncurses-dev", undefined, {
      env: {
        DEBIAN_FRONTEND: "noninteractive",
        TERM: "linux"
      }
    })
  }

  const makefilePlatform = process.platform === "darwin" ? "macosx" : "linux"
  const compileFlagsArray = [
    "-j",
    makefilePlatform,
  ]

  if (luaCompileFlags) {
    compileFlagsArray.push(luaCompileFlags)
  }

  await exec.exec("make", compileFlagsArray, {
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

