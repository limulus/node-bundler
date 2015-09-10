"use strict"

var Promise = require("bluebird")
var semver = require("semver")
var extend = require("extend")
var path = require("path")
var fs = require("fs")
var fse = require("fs-extra")
var split = require("split")
var crypto = require("crypto")
var tar = require("tar")
var zlib = require("zlib")

try { var lzma = require("lzma-native") } catch (e) { /* nada */ }

var request = (function (request) {
  return function (url, cb) {
    return request({
      url: url,
      headers: { "User-Agent": "request node-bundler (" + moduleVersion + ")" }
    }, cb)
  }
})(require("request"))

var Installation = require("./Installation.js")

var moduleVersion = require(path.resolve(__dirname, "..", "package.json")).version

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
    fse.mkdirs(cacheDir, function (err) {
      if (err) return reject(err)
      return resolve(cacheDir)
    })
  })

  this._version = new Promise(function (resolve, reject) {
    var indexJson = "https://nodejs.org/dist/index.json"
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
    return "node-v" + version + "-" + opts.platform + "-" + opts.arch + ".tar.gz"
  })

  this._installerFileUrl = Promise.join(this._version, this._installerFileName, function (version, installerFileName) {
    return "https://nodejs.org/dist/v" + version + "/" + installerFileName
  })

  this._srcFileName = this._version.then(function (version) {
    return "node-v" + version + ".tar." + (lzma ? "xz" : "gz")
  })

  this._srcFileUrl = Promise.join(this._version, this._srcFileName, function (version, srcFileName) {
    return "https://nodejs.org/dist/v" + version + "/" + srcFileName
  })

  this._downloadCacheDirForVersion = Promise.join(this._version, this._downloadCacheDir, function (version, downloadCacheDir) {
    return new Promise(function (resolve, reject) {
      var cacheDir = path.resolve(downloadCacheDir, version)
      fse.mkdirs(cacheDir, function (err) {
        if (err) return reject(err)
        return resolve(cacheDir)
      })
    })
  })

  this._shasums = Promise.join(this._downloadCacheDirForVersion, this._version, function (cacheDir, version) {
    return new Promise(function (resolve, reject) {
      var shasumsFileUrl = "https://nodejs.org/dist/v" + version + "/SHASUMS256.txt"
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

  this._installerFile = this._downloadAndCacheFile(this._installerFileUrl, this._installerFileName)

  this._srcFile = this._downloadAndCacheFile(this._srcFileUrl, this._srcFileName)

  this._srcDir = Promise.join(this._downloadCacheDirForVersion, this._srcFileName, this._srcFile, function (cacheDir, srcFileName, srcFilePath) {
    return new Promise(function (resolve, reject) {
      var srcDir = path.resolve(cacheDir, srcFileName.replace(/\.tar\.[xg]z$/, ""))
      fs.exists(path.resolve(srcDir, "README.md"), function (isExtracted) {
        if (isExtracted) return resolve(srcDir)
        var decompressStream = lzma ?
          lzma.createStream("autoDecoder") :
          zlib.createGunzip()
        fs.createReadStream(srcFilePath)
          .on("error", reject)
          .pipe(decompressStream)
            .on("error", reject)
            .pipe(tar.Extract({ path: cacheDir }))
              .on("error", reject)
              .on("finish", function () { return resolve(srcDir) })
      })
    })
  })

  this._extractedInstallDir = Promise.join(this._installerFileName, this._downloadCacheDirForVersion, this._installerFile, function (installerFileName, cacheDir, installerFilePath) {
    return new Promise(function (resolve, reject) {
      var installDirPath = path.resolve(cacheDir, installerFileName.replace(/\.tar\.gz$/, ""))
      fs.exists(path.resolve(installDirPath, "bin", "node"), function (isExtracted) {
        if (isExtracted) return resolve(installDirPath)
        fs.createReadStream(installerFilePath)
          .on("error", reject)
          .pipe(zlib.createGunzip())
            .on("error", reject)
            .pipe(tar.Extract({ path: cacheDir }))
              .on("error", reject)
              .on("finish", function () { return resolve(installDirPath) })
      })
    })
  })
}

Installer.prototype._downloadAndCacheFile = function (fileUrl, fileName) {
  return Promise.join(
    fileUrl, fileName, this._downloadCacheDirForVersion, this._shasums,
    function(fileUrl, fileName, cacheDir, shasums) {
      return new Promise(function (resolve, reject) {
        var cachedFilePath = path.join(cacheDir, fileName)
        var expectedShasum = shasums[fileName]
        if (expectedShasum === undefined) return reject(new Error("Could not find installer file in shasum list!"))
        fs.exists(cachedFilePath, function (isCached) {
          if (isCached) return resolve(validateShasum(cachedFilePath, expectedShasum))
          request(fileUrl)
            .on("error", reject)
            .pipe(fs.createWriteStream(cachedFilePath))
              .on("error", reject)
              .on("finish", function () { return resolve(validateShasum(cachedFilePath, expectedShasum)) })
        })
      })
    }
  )
}

Installer.prototype.install = function (installBasePath, cb) {
  var targetPath = this._targetPath

  Promise.join(
    this._version, this._srcDir, this._downloadCacheDirForVersion, this._extractedInstallDir,
    function (version, srcDir, cacheDir, extractedInstallDir) {
      var installPath = path.join(installBasePath, path.basename(extractedInstallDir))
      var fullInstallPath = path.resolve(targetPath, installPath)
      var installation = new Installation(version, srcDir, cacheDir, targetPath, installPath)
      fs.exists(fullInstallPath, function (alreadyInstalled) {
        if (alreadyInstalled) return cb(null, installation)
        fse.move(extractedInstallDir, fullInstallPath, function (err) {
          return cb(err, installation)
        })
      })
  }).then(null, function (err) {
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
