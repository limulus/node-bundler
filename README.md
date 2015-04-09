# iojs-bundler

Bundle io.js in native applications

## Synopsis

This module helps you automate including [io.js](https://iojs.org/) in binary distributions of your software. It handles the downloading of the io.js version you specify, and lets you run npm from within the bundled io.js environment — which is especially important for modules with native add-ons. It's actually kinda tricky to get this working right, so this module exists to make it so you don't have to worry about those details.

## Usage

An example, using [Gulp](http://gulpjs.com/), minus proper error handling:

```javascript
var iojsBundler = require("iojs-bundler")

gulp.task("iojs", function (done) {
  var installer = iojsBundler("dist/my.app", "^1.6.4")
  installer.install("Resources/ThirdParty/", function (err, installation) {
    installation.npm("Resources/my-iojs-app", ["install"], function (err) {
      return done()
    })
  })
})
```

## API

```javascript
var iojsBundler = require("iojs-bundler")
```

### iojsBundler(targetPath, versionRange)

Returns a new `Installer` instance. The `targetPath` you specify should be the full path to your target application bundle, plugin bundle, etc.

The `versionRange` is a [semver](https://npmjs.com/package/semver) range used to specify the highest allowed version of io.js to install. It probably makes sense to specify a specific version, considering that if a new release of io.js comes out in between runs, you may wind up with two versions installed in your application bundle, consuming unnecessary space.

### installer.install(relativeInstallPath, callback)

Downloads and installs the io.js binary distribution in a new directory, named something like `iojs-v1.6.4-linux-x64`, inside the directory specified by `relativeInstallPath`. Note that `relativeInstallPath` is relative to the `targetPath` parameter given to the `iojsBundler()` function.

The `callback` is a function which will be called with an `error` as its first argument if there was an error during the install process. If there was no error, the second argument will be an `Installation` instance.

### installation.version()

Returns the io.js version number of the installation.

### installation.binaryPath()

Returns the path of the `iojs` binary, relative to your application bundle target. You'll probably want to store this string somewhere inside your application bundle, so that your shipped application code can figure where to find the bundled `iojs` binary.

### installation.npm(cwd, arguments, [options], callback)

Runs the bundled `npm` binary in the context of the io.js installation. You specify `npm`'s current working directory relative to your application bundle target with the `cwd` parameter. The `arguments` and `options` parameters are passed along to the `child_process.spawn` function that runs `npm`.

When complete, the `callback` is called. If `npm` exits with an error code or signal, the first argument will contain an `Error` object.
