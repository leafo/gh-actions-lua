
const core = require('@actions/core')
const luaVersion = core.getInput('luaVersion')

console.log("hello world? " + luaVersion)
core.warning("this is a warning");



