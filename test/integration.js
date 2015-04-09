"use strict"

var assert = require("assert")
var path = require("path")
var fs = require("fs")
var fse = require("fs-extra")

var Installer = require("../lib/Installer.js")

var targetPath = path.resolve(__dirname, "..", "dist", "my.bundle")
var installPath = path.join("Resources", "ThirdParty")
var modulePath = path.resolve(__dirname, "..", "fixtures", "some-module")
var myiojsAppPath = path.join("Resources", "my-iojs-app")

describe("Installation (integration tests)", function () {
  var installer, installation

  before(function (done) {
    this.timeout(35000)

    fse.removeSync(targetPath)
    fse.mkdirsSync(path.resolve(targetPath, installPath))
    fse.mkdirsSync(path.resolve(targetPath, myiojsAppPath, "node_modules"))

    installer = new Installer(targetPath, "*")  // You should never use "*"
    installer.install(installPath, function (err, theInstallation) {
      assert.ifError(err)
      installation = theInstallation
      return done()
    })
  })

  it("should have installed something that looks like iojs", function () {
    var expectedIojsDirName = "iojs"
      + "-" + "v" + installation.version()
      + "-" + process.platform
      + "-" + process.arch
    var installedIojsBinPath = path.resolve(targetPath, installPath, expectedIojsDirName, "bin", "iojs")
    assert(fs.existsSync(installedIojsBinPath))
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
      var installedModulePackageJson = path.resolve(targetPath, myiojsAppPath, "node_modules", "some-module", "package.json")
      installation.npm(myiojsAppPath, ["install", modulePath], function (err) {
        assert.ifError(err)
        assert(fs.existsSync(installedModulePackageJson))
        return done()
      })
    })
  })
})
