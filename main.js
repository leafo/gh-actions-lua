
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
const isWindows = () => (process.platform || "").startsWith("win32")

const exists = (filename, mode) => fsp.access(filename, mode).then(() => true, () => false)

// Returns posix path for path.join()
const pathJoin = path.posix.join

// Returns posix path for process.cwd()
const processCwd = () => {
  return process.cwd().split(path.sep).join(path.posix.sep);
}

async function finish_luajit_install(src, dst, luajit) {
  if (isWindows()) {
    await fsp.copyFile(pathJoin(src, "lua51.dll"), pathJoin(dst, "bin", "lua51.dll"))

    await exec.exec(`ln -s ${luajit} lua.exe`, undefined, {
      cwd: pathJoin(dst, "bin")
    })
  } else {
    await exec.exec(`ln -s ${luajit} lua`, undefined, {
      cwd: pathJoin(dst, "bin")
    })
  }
}

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
    cwd: pathJoin(buildPath, "luajit2"),
    ...(isWindows() ? { env: { SHELL: 'cmd' }} : {})
  })

  await exec.exec(`make -j install PREFIX="${luaInstallPath}"`, undefined, {
    cwd: pathJoin(buildPath, "luajit2")
  })

  await finish_luajit_install(pathJoin(buildPath, "luajit2", "src"), luaInstallPath, "luajit")
}

async function install_luajit(luaInstallPath, luajitVersion) {
  const luaExtractPath = pathJoin(process.env["RUNNER_TEMP"], BUILD_PREFIX, `LuaJIT-${luajitVersion}`)

  const luaCompileFlags = core.getInput('luaCompileFlags')

  const luaSourceTar = await tc.downloadTool(`https://luajit.org/download/LuaJIT-${luajitVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, path.join(process.env["RUNNER_TEMP"], BUILD_PREFIX))

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

  await finish_luajit_install(pathJoin(luaExtractPath, "src"), luaInstallPath, `luajit-${luajitVersion}`)
}

async function msvc_link(luaExtractPath, linkCmd, outFile, objs) {
  await exec.exec(linkCmd + " /out:" + outFile, objs, {
    cwd: luaExtractPath
  })

  let manifest = outFile + ".manifest"
  if (await exists(manifest)) {
    await exec.exec("mt /nologo", ["-manifest", manifest, "-outputresource:" + outFile], {
      cwd: luaExtractPath
    })
  }
}

async function install_files(dstDir, srcDir, files) {
  await io.mkdirP(dstDir)
  for (let file of files) {
    await fsp.copyFile(pathJoin(srcDir, file), pathJoin(dstDir, path.posix.basename(file)))
  }
}

async function install_plain_lua_windows(luaExtractPath, luaInstallPath, luaVersion) {
  const luaCompileFlags = core.getInput('luaCompileFlags')

  let cl = "cl /nologo /MD /O2 /W3 /c /D_CRT_SECURE_NO_DEPRECATE"

  let objs = {
    "lib": [],
    "lua": [],
    "luac": [],
  }

  let sources = {
    "lua": [ "lua.c" ],
    "luac": [ "luac.c", "print.c" ],
  }

  let src = pathJoin(luaExtractPath, "src")

  await fsp.readdir(src).then(async (files) => {
    for (let file of files) {
      if (file.endsWith(".c")) {
        let mode = sources["lua"].includes(file)
                 ? "lua"
                 : sources["luac"].includes(file)
                 ? "luac"
                 : "lib"

        let srcName = pathJoin("src", file)

        let args = (mode === "lib")
                 ? [ "-DLUA_BUILD_AS_DLL", srcName ]
                 : [ srcName ]

        objs[mode].push(file.replace(".c", ".obj"))

        await exec.exec(cl, args, {
          cwd: luaExtractPath
        })
      }
    }
  })

  objs["lua"] = [ ...objs["lua"], ...objs["lib"] ]
  objs["luac"] = [ ...objs["luac"], ...objs["lib"] ]

  let luaXYZ = luaVersion.split(".")
  let libFile = "lua" + luaXYZ[0] + luaXYZ[1] + ".lib"
  let dllFile = "lua" + luaXYZ[0] + luaXYZ[1] + ".dll"

  await msvc_link(luaExtractPath, "link /nologo /DLL", dllFile, objs["lib"]);
  await msvc_link(luaExtractPath, "link /nologo", "luac.exe", objs["luac"]);
  await msvc_link(luaExtractPath, "link /nologo", "lua.exe", objs["lua"]);

  const luaHpp = (await exists(pathJoin(src, "lua.hpp"))) ? "lua.hpp" : "../etc/lua.hpp"
  const headers = [ "lua.h", "luaconf.h", "lualib.h", "lauxlib.h", luaHpp ]

  await install_files(pathJoin(luaInstallPath, "bin"), luaExtractPath, [ "lua.exe", "luac.exe" ])
  await install_files(pathJoin(luaInstallPath, "lib"), luaExtractPath, [ dllFile, libFile ])
  await install_files(pathJoin(luaInstallPath, "include"), src, headers)
}

async function install_plain_lua(luaInstallPath, luaVersion) {
  const luaExtractPath = pathJoin(process.env["RUNNER_TEMP"], BUILD_PREFIX, `lua-${luaVersion}`)
  const luaCompileFlags = core.getInput('luaCompileFlags')

  const luaSourceTar = await tc.downloadTool(`https://lua.org/ftp/lua-${luaVersion}.tar.gz`)
  await io.mkdirP(luaExtractPath)
  await tc.extractTar(luaSourceTar, path.join(process.env["RUNNER_TEMP"], BUILD_PREFIX))

  if (isWindows()) {
    return await install_plain_lua_windows(luaExtractPath, luaInstallPath, luaVersion);
  }

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

async function main() {
  let luaVersion = core.getInput('luaVersion', { required: true })

  if (VERSION_ALIASES[luaVersion]) {
    luaVersion = VERSION_ALIASES[luaVersion]
  }

  const luaInstallPath = pathJoin(processCwd(), LUA_PREFIX)

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

  core.addPath(pathJoin(luaInstallPath, "bin"))
}

main().catch(err => {
  core.setFailed(`Failed to install Lua: ${err}`);
})

