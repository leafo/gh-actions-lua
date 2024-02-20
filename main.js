
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
  "luajit": "luajit-openresty",
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

async function install_files(dstDir, srcDir, files) {
  await io.mkdirP(dstDir);
  for (const file of files) {
    await fsp.copyFile(
      pathJoin(srcDir, file),
      pathJoin(dstDir, path.posix.basename(file)),
    );
  }
}

async function fetch_luajit(buildPath, luajitVersion) {
  const luaExtractPath = pathJoin(buildPath, `LuaJIT-${luajitVersion}`);

  const luaSourceTar = await tc.downloadTool(
    `https://luajit.org/download/LuaJIT-${luajitVersion}.tar.gz`,
  );

  await io.mkdirP(luaExtractPath);
  await tc.extractTar(luaSourceTar, buildPath);

  return luaExtractPath;
}

async function fetch_luajit_openresty(buildPath) {
  await exec.exec(
    "git clone https://github.com/openresty/luajit2.git luajit",
    undefined,
    { cwd: buildPath },
  );
  return pathJoin(buildPath, "luajit");
}

async function fetch_luajit_git(buildPath) {
  await exec.exec(
    "git clone https://github.com/LuaJIT/LuaJIT luajit",
    undefined,
    { cwd: buildPath },
  );
  return pathJoin(buildPath, "luajit");
}

async function build_luajit_posix(srcPath) {
  const luaCompileFlags = core.getInput("luaCompileFlags");
  let finalCompileFlags = "-j";

  if (isMacOS()) {
    finalCompileFlags += " MACOSX_DEPLOYMENT_TARGET=10.15";
  }

  if (luaCompileFlags) {
    finalCompileFlags += ` ${luaCompileFlags}`;
  }

  await exec.exec(`make ${finalCompileFlags}`, undefined, {
    cwd: srcPath,
  });
}

async function install_luajit_posix(srcPath, luaInstallPath, exeName) {
  await exec.exec(`make -j install PREFIX="${luaInstallPath}"`, undefined, {
    cwd: srcPath,
  });

  if (exeName === undefined) {
    exeName = await fsp.readlink(pathJoin(luaInstallPath, "bin", "luajit"));
  }

  await fsp.symlink(exeName, pathJoin(luaInstallPath, "bin", "lua"));
}

async function build_luajit_windows(srcPath) {
  const luaCompileFlags = core.getInput("luaCompileFlags");
  let finalCompileFlags = "-j";

  if (luaCompileFlags) {
    finalCompileFlags += ` ${luaCompileFlags}`;
  }

  await exec.exec(`make SHELL=cmd.exe ${finalCompileFlags}`, undefined, {
    cwd: pathJoin(srcPath, "src"),
  });
}

async function install_luajit_windows(srcPath, luaInstallPath) {
  const srcDir = pathJoin(srcPath, "src");
  const binDir = pathJoin(luaInstallPath, "bin");

  {
    // install bin files
    await install_files(binDir, srcDir, ["luajit.exe", "lua51.dll"]);
    await fsp.symlink("luajit.exe", pathJoin(binDir, "lua.exe"));
  }

  {
    // install jit library
    const jitLibSrcDir = pathJoin(srcDir, "jit");
    const jitLibDstDir = pathJoin(binDir, "lua", "jit");

    await install_files(
      jitLibDstDir,
      jitLibSrcDir,
      (await fsp.readdir(jitLibSrcDir)).filter((file) => !file.startsWith(".")),
    );
  }

  {
    const incDir = pathJoin(luaInstallPath, "include", "luajit-2.1");
    const incDirCompat = pathJoin(luaInstallPath, "include", "5.1");
    await io.mkdirP(incDir);
    await io.mkdirP(incDirCompat);

    const incFiles = [
      "lua.h",
      "lua.hpp",
      "lauxlib.h",
      "luaconf.h",
      "lualib.h",
      "luajit.h",
    ];
    await install_files(incDir, srcDir, incFiles);
    await install_files(incDirCompat, srcDir, incFiles);
  }
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

  const luaSourceTar = await tc.downloadTool(`https://www.lua.org/ftp/lua-${luaVersion}.tar.gz`)
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

async function install_luajit(luaInstallPath, luajitVersion) {
  const buildPath = pathJoin(process.env["RUNNER_TEMP"], BUILD_PREFIX);

  await io.mkdirP(buildPath);

  let exeName;
  let srcPath;
  if (luajitVersion === "openresty") {
    srcPath = await fetch_luajit_openresty(buildPath);
  } else if (luajitVersion === "git") {
    srcPath = await fetch_luajit_git(buildPath);
  } else {
    srcPath = await fetch_luajit(buildPath, luajitVersion);
    exeName = `luajit-${luajitVersion}`;
  }

  if (isWindows()) {
    await build_luajit_windows(srcPath);
    await install_luajit_windows(srcPath, luaInstallPath);
  } else {
    await build_luajit_posix(srcPath);
    await install_luajit_posix(srcPath, luaInstallPath, exeName);
  }
}

async function install(luaInstallPath, luaVersion) {
  if (luaVersion.startsWith("luajit-")) {
    const luajitVersion = luaVersion.substr("luajit-".length);
    return await install_luajit(luaInstallPath, luajitVersion);
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

