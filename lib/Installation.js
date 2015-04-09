"use strict"

var Promise = require("bluebird")
var spawn = require("child_process").spawn
var path = require("path")
var extend = require("extend")
var fse = require("fs-extra")

var Installation = module.exports = function (version, srcDir, cacheDir, targetPath, installPath) {
  this._version = version
  this._srcDirPath = srcDir
  this._cacheDir = cacheDir
  this._targetPath = targetPath
  this._installPath = installPath

  this._npmCachePath = new Promise(function (resolve, reject) {
    var npmCachePath = path.resolve(this._cacheDir, "npm-cache")
    fse.mkdirs(npmCachePath, function (err) {
      if (err) return reject(err)
      return resolve(npmCachePath)
    }.bind(this))
  }.bind(this))
}

Installation.prototype.version = function () {
  return this._version
}

Installation.prototype.npm = function (cwd, args, opts, cb) {
  this._npmCachePath.then(function (npmCachePath) {
    cwd = cwd || this._targetPath
    cwd = path.resolve(this._targetPath, cwd)
    cb = cb || opts
    opts = extend({
      cwd: cwd,
      stdio: "inherit"
    }, opts === cb ? {} : opts)

    var callersEnvOverrides = opts.env
    opts.env = extend(process.env)

    // Fix up the environment to get npm working correctly in the bundled
    // io.js context. First, remove any npm_ env vars we may have inherited.
    Object.keys(opts.env).forEach(function (name) {
      if (name.match(/^npm_/)) delete opts.env[name]
    })

    // Now let's set npm's cache dir and nodedir (node source dir) to point
    // at the right things for this install.
    opts.env.npm_config_cache = npmCachePath
    opts.env.npm_config_nodedir = this._srcDirPath
    opts.env.PWD = cwd

    // Bring in caller's env overrides (what was originally opts.env)
    opts.env = extend(opts.env, callersEnvOverrides)

    // Next, let's make sure our bundled iojs, node and npm binaries are on
    // the PATH, such that they are chosen before any others installed on
    // the local system.
    opts.env.PATH = path.resolve(this._targetPath, this._installPath, "bin")
      + ":" + opts.env.PATH

    var npmBinPath = path.resolve(this._targetPath, this._installPath, "bin", "npm")
    spawn(npmBinPath, args, opts)
      .on("close", function (code, sig) {
        if (code !== 0 || sig) return cb(new Error("Got exit code (" + code + ") or signal (" + sig + ") from npm"))
        return cb(null)
      })
  }.bind(this))
}
