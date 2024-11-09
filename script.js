#!/usr/bin/env node

var fs = require('fs')
var nodePath = require('path')

var gitty = (module.exports = {
  init: function (opts) {
    if (files.inRepo()) {
      return
    }

    opts = opts || {}

    var gittyStructure = {
      HEAD: 'ref: refs/heads/master\n',

      config: config.objToStr({ core: { '': { bare: opts.bare === true } } }),

      objects: {},
      refs: {
        heads: {},
      },
    }

    files.writeFilesFromTree(
      opts.bare ? gittyStructure : { '.gitty': gittyStructure },
      process.cwd(),
    )
  },
})
