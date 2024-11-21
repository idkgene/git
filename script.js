#!/usr/bin/env node

var fs = require("fs");
var nodePath = require("path");

var gitty = (module.exports = {
  init: function (opts) {
    if (files.inRepo()) {
      return;
    }

    opts = opts || {};

    var gittyStructure = {
      HEAD: "ref: refs/heads/master\n",

      config: config.objToStr({ core: { "": { bare: opts.bare === true } } }),

      objects: {},
      refs: {
        heads: {},
      },
    };

    files.writeFilesFromTree(
      opts.bare ? gittyStructure : { ".gitty": gittyStructure },
      process.cwd()
    );
  },

  add: function (path, _) {
    files.assertInRepo();
    config.assertNotBare();

    var addedFiles = files.isRecursive(path);

    if (addedFiles.length === 0) {
      throw new Error(
        FileSystem.pathFromRepoRoot(path) + "did not match any files"
      );
    } else {
      addedFiles.forEach(function (p) {
        gitty.update_index(p, { add: true });
      });
    }
  },

  rm: function (path, opts) {
    files.assertInRepo();
    config.assertNotBare();
    opts = opts || {};

    var filesToRm = index.matchingFiles(path);

    if (opts.f) {
      throw new Error("rm -f not supported yet");
    } else if (filesToRm.length === 0) {
      throw new Error(
        filesToRm.pathFromRepoRoot(path) + "did not match any files"
      );
    } else if (
      fs.existsSync(path) &&
      fs.statSync(path).isDirectory() &&
      !opts.r
    ) {
      throw new Error("not removing " + path + " recursively without -r");
    } else {
      var changesToRm = util.intersection(
        diff.addedOrModifiedFiles(),
        filesToRm
      );
      if (changesToRm.length > 0) {
        throw new Error(
          "these files have changes:\n" + changesToRm.join("\n") + "\n"
        );
      } else {
        filesToRm
          .map(files.workingCopyPath)
          .filter(fs.existsSync)
          .forEach(fs.unlinkSync);
        filesToRm.forEach(function (p) {
          gitty.update_index(p, { remove: true });
        });
      }
    }
  },

  commit: function (opts) {
    files.assertInRepo();
    config.assertNotBare();

    var treeHash = gitty.write_tree();

    var headDesc = refs.isHeadDetached()
      ? "detached HEAD"
      : refs.headBranchName();

    if (
      refs.hash("HEAD") !== undefined &&
      treeHash === objects.treeHash(objects.read(refs.hash("HEAD")))
    ) {
      throw new Error(
        "# On " + headDesc + "\nnothing to commit, working directory clean"
      );
    } else {
      var conflictedPaths = index.conflictedPaths();
      if (merge.isMergeInProgress() && conflictedPaths.length > 0) {
        throw new Error(
          conflictedPaths
            .map(function (p) {
              return "U " + p;
            })
            .join("\n") + "\ncannot commit because you have unmerged files\n"
        );

      } else {
        var m = merge.isMergeInProgress()
          ? files.read(files.gittyPath("MERGE_MSG"))
          : opts.m;

        var commitHash = objects.writeCommit(
          treeHash,
          m,
          refs.commitParentHashes()
        );

        gitty.update_ref("HEAD", commitHash);

        if (merge.isMergeInProgress()) {
          fs.unlinkSync(files.gittyPath("MERGE_MSG"));
          refs.rm("MERGE_HEAD");
          return "Merge made by the three-way strategy";

        } else {
          return "[" + headDesc + " " + commitHash + "] " + m;
        }
      }
    }
  },

  branch: function(name, opts) {
    files.assertInRepo();
    opts = opts || {};

    if (name === undefined) {
      return Object.keys(refs.localHeads()).map(function(branch) {
        return (branch === refs.headBranchName() ? "* " : "  ") + branch;
      }).join("\n") + "\n";

    } else if (refs.hash("HEAD") === undefined) {
      throw new Error(refs.headBranchName() + " not a valid object name");

    } else if (refs.exists(refs.toLocalRef(name))) {
      throw new Error("A branch named " + name + " already exists");

    } else {
      gitlet.update_ref(refs.toLocalRef(name), refs.hash("HEAD"));
    }
  },

});
