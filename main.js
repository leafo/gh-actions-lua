
const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require("@actions/io")
const tc = require("@actions/tool-cache")
const ch = require("@actions/cache")
const fsp = require("fs").promises

const path = require("path")

const INSTALL_PREFIX = ".install"
const LUA_PREFIX = ".lua"

const VERSION_ALIASES = {
  "5.1": "5.1.5",
  "5.2": "5.2.4",
  "5.3": "5.3.6",
  "5.4": "5.4.2",
  "luajit": "luajit-2.1.0-beta3",
}

const isMacOS = () => (process.platform || "").startsWith("darwin")

async function install_luajit_openresty(luaInstallPath) {
  const installPath = path.join(process.cwd(), INSTALL_PREFIX)
  const luaCompileFlags = core.getInput('luaCompileFlags')

  await io.mkdirP(installPath)

  await exec.exec("git clone https://github.com/openresty/luajit2.git", undefined, {
    cwd: installPath
  })

  const compileFlagsArray = [ "-j" ]

  if (isMacOS()) {
    compileFlagsArray.push("MACOSX_DEPLOYMENT_TARGET=10.15")
  }

  if (luaCompileFlags) {
    compileFlagsArray.push(luaCompileFlags)
  }

  await exec.exec("make", compileFlagsArray, {
    cwd: path.join(installPath, "luajit2")
  })

  await exec.exec(`make -j install PREFIX="${luaInstallPath}"`, undefined, {
    cwd: path.join(installPath, "luajit2")
  })

  await exec.exec("ln -s luajit lua", undefined, {
    cwd: path.join(luaInstallPath, "bin")
  })
}

async function install_luajit(luaInstallPath, luajitVersion) {
  const luaExtractPath = path.join(process.cwd(), INSTALL_PREFIX, `LuaJIT-${luajitVersion}`)

  const luaCompileFlags = core.getInput('luaCompileFlags')

  const luaSourceTar = await tc.downloadTool(`https://luajit.org/download/LuaJIT-${luajitVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, INSTALL_PREFIX)

  const compileFlagsArray = [ "-j" ]

  if (isMacOS()) {
    compileFlagsArray.push("MACOSX_DEPLOYMENT_TARGET=10.15")
  }

  if (luaCompileFlags) {
    compileFlagsArray.push(luaCompileFlags)
  }

  await exec.exec("make", compileFlagsArray, {
    cwd: luaExtractPath
  })

  await exec.exec(`make -j install PREFIX="${luaInstallPath}"`, undefined, {
    cwd: luaExtractPath
  })

  await exec.exec(`ln -s luajit-${luajitVersion} lua`, undefined, {
    cwd: path.join(luaInstallPath, "bin")
  })
}

async function install_plain_lua(luaInstallPath, luaVersion) {
  const luaExtractPath = path.join(process.cwd(), INSTALL_PREFIX, `lua-${luaVersion}`)
  const luaCompileFlags = core.getInput('luaCompileFlags')

  const luaSourceTar = await tc.downloadTool(`https://www.lua.org/ftp/lua-${luaVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, INSTALL_PREFIX)

  if (isMacOS()) {
    await exec.exec("brew install readline ncurses")
  } else {
    await exec.exec("sudo apt-get install -q libreadline-dev libncurses-dev", undefined, {
      env: {
        DEBIAN_FRONTEND: "noninteractive",
        TERM: "linux"
      }
    })
  }

  const makefilePlatform = isMacOS() ? "macosx" : "linux"
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
}

async function install(luaInstallPath, luaVersion) {
  if (luaVersion == "luajit-openresty") {
    return await install_luajit_openresty(luaInstallPath)
  }

  if (luaVersion.startsWith("luajit-")) {
    const luajitVersion = luaVersion.substr("luajit-".length)
    return await install_luajit(luaInstallPath, luajitVersion)
  }

  return await install_plain_lua(luaInstallPath, luaVersion)
}

const makeCacheKey = luaVersion=> `setup-lua-${luaVersion}-${process.platform}-${process.arch}`
const exists = (filename, mode) => fsp.access(filename, mode).then(() => true, () => false)

async function main() {
  let luaVersion = core.getInput('luaVersion', { required: true })
  let luaCompileFlags = core.getInput('luaCompileFlags')

  if (VERSION_ALIASES[luaVersion]) {
    luaVersion = VERSION_ALIASES[luaVersion]
  }

  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)

  let toolCacheDir = tc.find('lua', luaVersion)

  if (!toolCacheDir) {
    const cacheKey = makeCacheKey(luaVersion)
    if (core.getInput('buildCache') == 'true') {
      const restoredCache = await ch.restoreCache([luaInstallPath], cacheKey)
      if (restoredCache) {
        core.notice(`Cache restored: ${restoredCache}`)
      } else {
        core.notice(`No cache available, clean build`)
      }
    }

    if (!(await exists(luaInstallPath))) {
      await install(luaInstallPath, luaVersion)
      try {
        core.notice(`Storing into cache: ${cacheKey}`)
        await ch.saveCache([luaInstallPath], cacheKey)
      } catch (e) {
        core.warning(`Failed to save to cache (continuing anyway): ${e}`)
      }
    }

    toolCacheDir = await tc.cacheDir(luaInstallPath, 'lua', luaVersion)
  }

  // If .lua doesn't exist, symlink it to the tool cache dir
  if (toolCacheDir && !(await exists(luaInstallPath))) {
    await fsp.symlink(toolCacheDir, luaInstallPath);
  }

  core.addPath(path.join(luaInstallPath, "bin"))
}

main().catch(err => {
  core.setFailed(`Failed to install Lua: ${err}`);
})

