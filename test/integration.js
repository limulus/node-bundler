"use strict"

var assert = require("assert")
var mkdirp = require("mkdirp")
var rimraf = require("rimraf")
var path = require("path")
var fs = require("fs")

var Installer = require("../lib/Installer.js")

var targetPath = path.resolve(__dirname, "..", "dist", "my.bundle")
var installPath = path.join("Resources", "ThirdParty")
var modulePath = path.resolve(__dirname, "..", "fixtures", "some-module")

describe("Installation (integration tests)", function () {
  var installer, installation

  before(function (done) {
    this.timeout(5000)

    rimraf.sync(targetPath)
    mkdirp.sync(path.resolve(targetPath, installPath))

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
      var myiojsAppPath = path.resolve(targetPath, "Resources/my-iojs-app")
      var installedModulePackageJson = path.resolve(myiojsAppPath, "node_modules", "some-module", "package.json")

      mkdirp.sync(myiojsAppPath)
      installation.npm(myiojsAppPath, ["install", modulePath], function (err) {
        assert.ifError(err)
        assert(fs.existsSync(installedModulePackageJson))
        return done()
      })
    })
  })
})
