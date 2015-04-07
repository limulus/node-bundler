"use strict"

var Promise = require("bluebird")
var semver = require("semver")
var request = require("request")

var Installation = require("./Installation.js")

var Installer = module.exports = function (targetPath, versionSelector, opts) {
  this._targetPath = targetPath

  if (semver.validRange(versionSelector) === null) {
    throw new Error("Error validationg version selector: " + versionSelector)
  }

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
}

Installer.prototype.install = function (installPath, cb) {
  this._version.then(
    function (version) {
      var installation = new Installation(version)
      return cb(null, installation)
    }.bind(this),
    function (err) {
      return cb(err)
    }.bind(this)
  )
}
