
const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require("@actions/io")
const tc = require("@actions/tool-cache")
const ch = require("@actions/cache")
const fsp = require("fs").promises

const notice = (msg) => core.notice(`gh-actions-lua: ${msg}`)
const warning = (msg) => core.warning(`gh-actions-lua: ${msg}`)

const path = require("path")

const BUILD_PREFIX = ".lua-build" // this is a temporary folder where lua will be built
const LUA_PREFIX = ".lua" // this is where Lua will be installed

const VERSION_ALIASES = {
  "5.1": "5.1.5",
  "5.2": "5.2.4",
  "5.3": "5.3.6",
  "5.4": "5.4.4",
  "luajit": "luajit-2.1.0-beta3",
}

const isMacOS = () => (process.platform || "").startsWith("darwin")

async function install_luajit_openresty(luaInstallPath) {
  const buildPath = path.join(process.env["RUNNER_TEMP"], BUILD_PREFIX)
  const luaCompileFlags = core.getInput('luaCompileFlags')

  await io.mkdirP(buildPath)

  await exec.exec("git clone https://github.com/openresty/luajit2.git", undefined, {
    cwd: buildPath
  })

  let finalCompileFlags = "-j"

  if (isMacOS()) {
    finalCompileFlags += " MACOSX_DEPLOYMENT_TARGET=10.15"
  }

  if (luaCompileFlags) {
    finalCompileFlags += ` ${luaCompileFlags}`
  }

  await exec.exec(`make ${finalCompileFlags}`, undefined, {
    cwd: path.join(buildPath, "luajit2")
  })

  await exec.exec(`make -j install PREFIX="${luaInstallPath}"`, undefined, {
    cwd: path.join(buildPath, "luajit2")
  })

  await exec.exec("ln -s luajit lua", undefined, {
    cwd: path.join(luaInstallPath, "bin")
  })
}

async function install_luajit(luaInstallPath, luajitVersion) {
  const luaExtractPath = path.join(process.env["RUNNER_TEMP"], BUILD_PREFIX, `LuaJIT-${luajitVersion}`)

  const luaCompileFlags = core.getInput('luaCompileFlags')

  const luaSourceTar = await tc.downloadTool(`https://luajit.org/download/LuaJIT-${luajitVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, path.join(process.env["RUNNER_TEMP"], BUILD_PREFIX)

  let finalCompileFlags = "-j"

  if (isMacOS()) {
    finalCompileFlags += " MACOSX_DEPLOYMENT_TARGET=10.15"
  }

  if (luaCompileFlags) {
    finalCompileFlags += ` ${luaCompileFlags}`
  }

  await exec.exec(`make ${finalCompileFlags}`, undefined, {
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
  const luaExtractPath = path.join(process.env["RUNNER_TEMP"], BUILD_PREFIX, `lua-${luaVersion}`)
  const luaCompileFlags = core.getInput('luaCompileFlags')

  const luaSourceTar = await tc.downloadTool(`https://www.lua.org/ftp/lua-${luaVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, path.join(process.env["RUNNER_TEMP"], BUILD_PREFIX))

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

  let finalCompileFlags = `-j ${isMacOS() ? "macosx" : "linux"}`

  if (luaCompileFlags) {
    finalCompileFlags += ` ${luaCompileFlags}`
  }

  await exec.exec(`make ${finalCompileFlags}`, undefined, {
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

const makeCacheKey = (luaVersion, compileFlags) => `lua:${luaVersion}:${process.platform}:${process.arch}:${compileFlags}`
const exists = (filename, mode) => fsp.access(filename, mode).then(() => true, () => false)

async function main() {
  let luaVersion = core.getInput('luaVersion', { required: true })

  if (VERSION_ALIASES[luaVersion]) {
    luaVersion = VERSION_ALIASES[luaVersion]
  }

  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)

  let toolCacheDir = tc.find('lua', luaVersion)

  if (!toolCacheDir) {
    const cacheKey = makeCacheKey(luaVersion, core.getInput('luaCompileFlags') || "")
    if (core.getInput('buildCache') == 'true') {
      const restoredCache = await ch.restoreCache([luaInstallPath], cacheKey)
      if (restoredCache) {
        notice(`Cache restored: ${restoredCache}`)
      } else {
        notice(`No cache available, clean build`)
      }
    }

    if (!(await exists(luaInstallPath))) {
      await install(luaInstallPath, luaVersion)
      try {
        notice(`Storing into cache: ${cacheKey}`)
        await ch.saveCache([luaInstallPath], cacheKey)
      } catch (e) {
        warning(`Failed to save to cache (continuing anyway): ${e}`)
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

