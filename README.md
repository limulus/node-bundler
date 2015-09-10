# node-bundler

Bundle Node.js in native applications

## Synopsis

This module helps you automate including [Node.js](https://nodejs.org/) in binary distributions of your software. It handles the downloading of the Node.js version you specify, and lets you run npm from within the bundled Node.js environment — which is especially important for modules with native add-ons. It's actually kinda tricky to get this working right, so this module exists to make it so you don't have to worry about those details.

## Compatibility

This module was formerly called iojs-bundler, and as such it has not been tested on versions of Node.js prior to v4.0.0. It is also unlikely to work on Windows — but PRs for Windows support would be welcome!

## Usage

An example, using [Gulp](http://gulpjs.com/), minus proper error handling:

```javascript
var nodeBundler = require("node-bundler")

gulp.task("node", function (done) {
  var installer = nodeBundler("dist/my.app", "^4.0.0")
  installer.install("Resources/ThirdParty/", function (err, installation) {
    installation.npm("Resources/my-node-app", ["install"], function (err) {
      return done()
    })
  })
})
```

## API

```javascript
var nodeBundler = require("node-bundler")
```

### nodeBundler(targetPath, versionRange)

Returns a new `Installer` instance. The `targetPath` you specify should be the full path to your target application bundle, plugin bundle, etc.

The `versionRange` is a [semver](https://npmjs.com/package/semver) range used to specify the highest allowed version of Node.js to install. It probably makes sense to specify a specific version, considering that if a new release of Node.js comes out in between runs, you may wind up with two versions installed in your application bundle, consuming unnecessary space.

### installer.install(relativeInstallPath, callback)

Downloads and installs the Node.js binary distribution in a new directory, named something like `nodejs-v4.0.0-linux-x64`, inside the directory specified by `relativeInstallPath`. Note that `relativeInstallPath` is relative to the `targetPath` parameter given to the `nodeBundler()` function.

The `callback` is a function which will be called with an `error` as its first argument if there was an error during the install process. If there was no error, the second argument will be an `Installation` instance.

### installation.version()

Returns the Node.js version number of the installation.

### installation.binaryPath()

Returns the path of the `node` binary, relative to your application bundle target. You'll probably want to store this string somewhere inside your application bundle, so that your shipped application code can figure where to find the bundled `node` binary.

### installation.npm(cwd, arguments, [options], callback)

Runs the bundled `npm` binary in the context of the node.js installation. You specify `npm`'s current working directory relative to your application bundle target with the `cwd` parameter. The `arguments` and `options` parameters are passed along to the `child_process.spawn` function that runs `npm`.

When complete, the `callback` is called. If `npm` exits with an error code or signal, the first argument will contain an `Error` object.
