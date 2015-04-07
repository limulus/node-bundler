# iojs-bundler

Bundle io.js in native applications

## Synopsis

This module helps you automate including [io.js](https://iojs.org/) in binary distributions of your software. It handles the downloading of the io.js version you specify, and lets you run npm from within the bundled io.js environment, which is especially important for modules with native add-ons. It's actually kinda tricky to get this working right, so this module makes it so you don't have to worry about those details.

## Usage

An example, using [Gulp](http://gulpjs.com/).

```javascript
var gulp = require("gulp")
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
