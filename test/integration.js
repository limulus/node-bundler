"use strict"

var assert = require("assert")
var path = require("path")
var fs = require("fs")
var fse = require("fs-extra")

var Installer = require("../lib/Installer.js")

var targetPath = path.resolve(__dirname, "..", "dist", "my.bundle")
var installPath = path.join("Resources", "ThirdParty")
var modulePath = path.resolve(__dirname, "..", "fixtures", "some-module")
var myNodeAppPath = path.join("Resources", "my-node-app")

describe("Installation (integration tests)", function () {
  var installer, installation

  before(function (done) {
    this.timeout(35000)

    fse.removeSync(targetPath)
    fse.mkdirsSync(path.resolve(targetPath, installPath))
    fse.mkdirsSync(path.resolve(targetPath, myNodeAppPath, "node_modules"))

    installer = new Installer(targetPath, "*")  // You should never use "*"
    installer.install(installPath, function (err, theInstallation) {
      assert.ifError(err)
      installation = theInstallation
      return done()
    })
  })

  var expectedNodeDirName = function () {
    return "node"
      + "-" + "v" + installation.version()
      + "-" + process.platform
      + "-" + process.arch
  }

  it("should have installed something that looks like node", function () {
    var installedNodeBinPath = path.resolve(targetPath, installPath, expectedNodeDirName(), "bin", "node")
    assert(fs.existsSync(installedNodeBinPath))
    return
  })

  describe("version()", function () {
    it("should return the version that has been installed", function () {
      assert(installation.version().match(/^\d+\.\d+\.\d+$/))
    })
  })

  describe("npm()", function () {
    it("should be able to install a module", function (done) {
      this.timeout(10000)
      var installedModulePackageJson = path.resolve(targetPath, myNodeAppPath, "node_modules", "some-module", "package.json")
      installation.npm(myNodeAppPath, ["install", modulePath], function (err) {
        assert.ifError(err)
        assert(fs.existsSync(installedModulePackageJson))
        return done()
      })
    })
  })

  describe("binaryPath()", function () {
    it("should return the path to the node binary relative to the target", function () {
      var version = installation.version()
      var expectedPath = path.join(installPath, expectedNodeDirName(), "bin", "node")
      assert.strictEqual(installation.binaryPath(), expectedPath)
    })
  })
})
