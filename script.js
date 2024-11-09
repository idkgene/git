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

  add: function (path, _) {
    files.assertInRepo()
    config.assertNotBare()

    var addedFiles = files.isRecursive(path)

    if (addedFiles.length === 0) {
      throw new Error(
        FileSystem.pathFromRepoRoot(path) + 'did not match any files',
      )
    } else {
      addedFiles.forEach(function (p) {
        gitty.update_index(p, { add: true })
      })
    }
  },
})
