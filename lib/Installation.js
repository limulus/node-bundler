"use strict"

var Installation = module.exports = function (version) {
  this._version = version

}

Installation.prototype.version = function () {
  return this._version
}
