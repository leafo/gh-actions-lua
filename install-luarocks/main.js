
const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require("@actions/io")
const tc = require("@actions/tool-cache")

const path = require("path")

const INSTALL_PREFIX = ".install"

const LUA_PREFIX = ".lua"
const LUAROCKS_PREFIX = ".luarocks"

// mkdir -p .install
// LUA_INSTALL_DIR="$(pwd)/.lua"
// LUAROCKS_INSTALL_DIR="$(pwd)/.luarocks"
// mkdir -p "$LUAROCKS_INSTALL_DIR"
// cd .install
// curl -L https://luarocks.org/releases/luarocks-${{ matrix.luarocks_version }}.tar.gz | tar xz
// cd luarocks-${{ matrix.luarocks_version }}
// ./configure --with-lua-bin="${LUA_INSTALL_DIR}/bin" --prefix="$LUAROCKS_INSTALL_DIR"
// # make bootstrap # this will work on luarocks >= 3.2.1
// make
// make install

async function main() {
  const luaRocksVersion = core.getInput('luaRocksVersion', { required: true })

  const luaRocksExtractPath = path.join(process.cwd(), INSTALL_PREFIX, `luarocks-${luaRocksVersion}`)
  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)
  const luaRocksInstallPath = path.join(process.cwd(), LUAROCKS_PREFIX)

  const sourceTar = await tc.downloadTool(`https://luarocks.org/releases/luarocks-${luaRocksVersion}.tar.gz`)
  await io.mkdirP(luaRocksExtractPath)
  await tc.extractTar(sourceTar, INSTALL_PREFIX)

  await exec.exec(`./configure --with-lua-bin="${luaInstallPath}/bin" --prefix="${luaRocksInstallPath}"`, undefined, {
    cwd: luaRocksExtractPath
  })

  await exec.exec("make", undefined, {
    cwd: luaRocksExtractPath
  })

  await exec.exec("make install", undefined, {
    cwd: luaRocksExtractPath
  })

  // Update environment to use luarocks directly
  let lrPath = ""

  core.warning(path.join(luaRocksInstallPath, "bin"))
  await exec.exec("find", [path.join(luaRocksInstallPath, "bin")])

  await exec.exec("luarocks path --lr-bin", undefined, {
    cwd: path.join(luaRocksInstallPath, "bin"),
    listeners: {
      stdout: (data) => {
        lrPath += data.toString()
      }
    }
  })

  if (lrPath != "") {
    core.addPath(lrPath);
  }
}

main().catch(err => {
  core.setFailed(`Failed to install LuaRocks: ${err}`);
})

