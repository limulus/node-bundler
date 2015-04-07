"use strict"

var Installer = require("./lib/Installer.js")

module.exports = function (appBundlePath, versionSelector, opts) {
  return new Installer(appBundlePath, versionSelector, opts)
}
