"use strict"

var assert = require("assert")
var mkdirp = require("mkdirp")
var rimraf = require("rimraf")
var path = require("path")

var Installer = require("../lib/Installer.js")

var targetPath = path.resolve(__dirname, "..", "dist", "my.bundle")
var installPath = path.join("Resources", "ThirdParty")

describe("Installation (integration tests)", function () {
  var installer, installation

  before(function (done) {
    rimraf.sync(targetPath)
    mkdirp.sync(path.resolve(targetPath, installPath))

    installer = new Installer(targetPath, "*")  // You should never use "*"
    installer.install(installPath, function (err, theInstallation) {
      assert.ifError(err)
      installation = theInstallation
      return done()
    })
  })

  describe("version()", function () {
    it("should return the version that has been installed", function () {
      assert(installation.version().match(/^\d+\.\d+\.\d+$/))
    })
  })
})
