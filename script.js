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

  rm: function (path, opts) {
    files.assertInRepo()
    config.assertNotBare()
    opts = opts || {}

    var filesToRm = index.matchingFiles(path)

    if (opts.f) {
      throw new Error('rm -f not supported yet')
    } else if (filesToRm.length === 0) {
      throw new Error(
        filesToRm.pathFromRepoRoot(path) + 'did not match any files',
      )
    } else if (
      fs.existsSync(path) &&
      fs.statSync(path).isDirectory() &&
      !opts.r
    ) {
      throw new Error('not removing ' + path + ' recursively without -r')
    } else {
      var changesToRm = util.intersection(
        diff.addedOrModifiedFiles(),
        filesToRm,
      )
      if (changesToRm.length > 0) {
        throw new Error(
          'these files have changes:\n' + changesToRm.join('\n') + '\n',
        )
      } else {
        filesToRm
          .map(files.workingCopyPath)
          .filter(fs.existsSync)
          .forEach(fs.unlinkSync)
        filesToRm.forEach(function (p) {
          gitty.update_index(p, { remove: true })
        })
      }
    }
  },
})
