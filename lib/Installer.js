"use strict"

var Promise = require("bluebird")
var semver = require("semver")
var request = require("request")
var extend = require("extend")
var mkdirp = require("mkdirp")
var path = require("path")
var fs = require("fs")
var split = require("split")
var crypto = require("crypto")

var Installation = require("./Installation.js")

var Installer = module.exports = function (targetPath, versionSelector, opts) {
  this._targetPath = targetPath

  if (semver.validRange(versionSelector) === null) {
    throw new Error("Error validationg version selector: " + versionSelector)
  }

  this._opts = opts = extend({
    platform: process.platform,
    arch: process.arch
  }, opts)

  this._downloadCacheDir = new Promise(function (resolve, reject) {
    var cacheDir = path.resolve(__dirname, "..", "cache")
    mkdirp(cacheDir, function (err) {
      if (err) return reject(err)
      return resolve(cacheDir)
    })
  })

  this._version = new Promise(function (resolve, reject) {
    var indexJson = "https://iojs.org/dist/index.json"
    request(indexJson, function (err, res, body) {
      if (err) {
        return reject(err)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(indexJson + ": Unexpected status code: " + res.statusCode))
      }
      if (res.headers['content-type'] !== "application/json") {
        return reject(new Error(indexJson + ": Unexpected Content-Type: " + res.headers['content-type']))
      }

      try { var index = JSON.parse(body) }
      catch (e) { return reject(e) }

      var versions = index.map(function (release) { return release.version.replace(/^v/, "") })
      var satisfyingVersion = semver.maxSatisfying(versions, versionSelector)
      if (satisfyingVersion === null) {
        return reject(new Error("No version satisfies semver range: " + versionSelector))
      }

      return resolve(satisfyingVersion)
    })
  })

  this._installerFileName = this._version.then(function (version) {
    return "iojs-v" + version + "-" + opts.platform + "-" + opts.arch + ".tar.gz"
  })

  this._downloadCacheDirForVersion = Promise.join(this._version, this._downloadCacheDir, function (version, downloadCacheDir) {
    return new Promise(function (resolve, reject) {
      var cacheDir = path.resolve(downloadCacheDir, version)
      mkdirp(cacheDir, function (err) {
        if (err) return reject(err)
        return resolve(cacheDir)
      })
    })
  })

  this._shasums = Promise.join(this._downloadCacheDirForVersion, this._version, function (cacheDir, version) {
    return new Promise(function (resolve, reject) {
      var shasumsFileUrl = "https://iojs.org/dist/v" + version + "/SHASUMS256.txt"
      var cachedShasumFilePath = path.join(cacheDir, "SHASUM256.txt")
      fs.exists(cachedShasumFilePath, function (isCached) {
        if (isCached) return resolve(parseShasumFile(cachedShasumFilePath))
        request(shasumsFileUrl)
          .on("error", reject)
          .pipe(fs.createWriteStream(cachedShasumFilePath))
            .on("error", reject)
            .on("finish", function () { return resolve(parseShasumFile(cachedShasumFilePath)) })
      })
    })
  })

  this._installerFilePath = Promise.join(
    this._version, this._downloadCacheDirForVersion, this._installerFileName, this._shasums,
    function (version, cacheDir, installerFileName, shasums) {
      return new Promise(function (resolve, reject) {
        var installerFileUrl = "https://iojs.org/dist/v" + version + "/" + installerFileName
        var cachedInstallerFilePath = path.join(cacheDir, installerFileName)
        var expectedShasum = shasums[installerFileName]
        if (expectedShasum === undefined) return reject(new Error("Could not find installer file in shasum list!"))
        fs.exists(cachedInstallerFilePath, function (isCached) {
          if (isCached) return resolve(validateShasum(cachedInstallerFilePath, expectedShasum))
          request(installerFileUrl)
            .on("error", reject)
            .pipe(fs.createWriteStream(cachedInstallerFilePath))
              .on("error", reject)
              .on("finish", function () { return resolve(validateShasum(cachedInstallerFilePath, expectedShasum)) })
        })
      })
    }
  )
}

Installer.prototype.install = function (installPath, cb) {
  Promise.join(this._version, this._installerFilePath, function (version, installerFilePath) {
    var installation = new Installation(version)
    console.error(installerFilePath)
    return cb(null, installation)
  })
  .then(null, function (err) {
    return cb(err)
  })
}

function parseShasumFile (path) {
  return new Promise(function (resolve, reject) {
    var shasums = {}
    fs.createReadStream(path)
      .on("error", reject)
      .pipe(split())
        .on("error", reject)
        .on("data", function (line) {
          var parts = line.match(/^(.+?)\s+(.+?)\s*$/)
          if (parts) shasums[parts[2]] = parts[1]
        })
        .on("end", function () {
          return resolve(shasums)
        })
  })
}

function validateShasum (path, expectedShasum) {
  return new Promise(function (resolve, reject) {
    var hash = crypto.createHash("sha256")
    fs.createReadStream(path)
      .on("error", reject)
      .pipe(hash)
        .on("error", reject)
        .on("finish", function () {
          var shasum = hash.read().toString("hex")
          if (shasum === expectedShasum) {
            return resolve(path)
          }
          else {
            return reject(new Error(path + ": expected sha256 " + expectedShasum + " but got " + shasum))
          }
        })
  })
}
