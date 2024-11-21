#!/usr/bin/env node

const util = require('./utils.js');
const files = require("./files.js");
const refs = require("./refs.js");
const objects = require("./objects.js");
const index = require("./index.js");
const diff = require("./diff.js");
const merge = require("./merge.js");
const workingCopy = require("./workingCopy.js");
const config = require("./config.js");
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

    var addedFiles = files.lsRecursive(path);

    if (addedFiles.length === 0) {
      throw new Error(
        files.pathFromRepoRoot(path) + " did not match any files"
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
      throw new Error("unsupported");
    } else if (filesToRm.length === 0) {
      throw new Error(
        files.pathFromRepoRoot(path) + " did not match any files"
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

  branch: function (name, opts) {
    files.assertInRepo();
    opts = opts || {};

    if (name === undefined) {
      return (
        Object.keys(refs.localHeads())
          .map(function (branch) {
            return (branch === refs.headBranchName() ? "* " : "  ") + branch;
          })
          .join("\n") + "\n"
      );
    } else if (refs.hash("HEAD") === undefined) {
      throw new Error(refs.headBranchName() + " not a valid object name");
    } else if (refs.exists(refs.toLocalRef(name))) {
      throw new Error("A branch named " + name + " already exists");
    } else {
      gitty.update_ref(refs.toLocalRef(name), refs.hash("HEAD"));
    }
  },

  checkout: function (ref, _) {
    files.assertInRepo();
    config.assertNotBare();

    var toHash = refs.hash(ref);

    if (!objects.exists(toHash)) {
      throw new Error(ref + " did not match any file(s) known to gitty");
    } else if (objects.type(objects.read(toHash)) !== "commit") {
      throw new Error("reference is not a tree: " + ref);
    } else if (
      ref === refs.headBranchName() ||
      ref === files.read(files.gittyPath("HEAD"))
    ) {
      return "Already on " + ref;
    } else {
      var paths = diff.changedFilesCommitWouldOverwrite(toHash);
      if (paths.length > 0) {
        throw new Error(
          "local changes would be lost\n" + paths.join("\n") + "\n"
        );
      } else {
        process.chdir(files.workingCopyPath());

        var isDetachingHead = objects.exists(ref);

        workingCopy.write(diff.diff(refs.hash("HEAD"), toHash));

        refs.write(
          "HEAD",
          isDetachingHead ? toHash : "ref: " + refs.toLocalRef(ref)
        );

        index.write(index.tocToIndex(objects.commitToc(toHash)));

        return isDetachingHead
          ? "Note: checking out " + toHash + "\nYou are in detached HEAD state."
          : "Switched to branch " + ref;
      }
    }
  },

  diff: function (ref1, ref2, opts) {
    files.assertInRepo();
    config.assertNotBare();

    if (ref1 !== undefined && refs.hash(ref1) === undefined) {
      throw new Error("ambiguous argument " + ref1 + ": unknown revision");
    } else if (ref2 !== undefined && refs.hash(ref2) === undefined) {
      throw new Error("ambiguous argument " + ref2 + ": unknown revision");
    } else {
      var nameToStatus = diff.nameStatus(
        diff.diff(refs.hash(ref1), refs.hash(ref2))
      );

      return (
        Object.keys(nameToStatus)
          .map(function (path) {
            return nameToStatus[path] + " " + path;
          })
          .join("\n") + "\n"
      );
    }
  },

  remote: function (command, name, path, _) {
    files.assertInRepo();

    if (command !== "add") {
      throw new Error("unsupported");
    } else if (name in config.read()["remote"]) {
      throw new Error("remote " + name + " already exists");
    } else {
      config.write(util.setIn(config.read(), ["remote", name, "url", path]));
      return "\n";
    }
  },

  fetch: function (remote, branch, _) {
    files.assertInRepo();

    if (remote === undefined || branch === undefined) {
      throw new Error("unsupported");
    } else if (!(remote in config.read().remote)) {
      throw new Error(remote + " does not appear to be a git repository");
    } else {
      var remoteUrl = config.read().remote[remote].url;

      var remoteRef = refs.toRemoteRef(remote, branch);

      var newHash = util.onRemote(remoteUrl)(refs.hash, branch);

      if (newHash === undefined) {
        throw new Error("couldn't find remote ref " + branch);
      } else {
        var oldHash = refs.hash(remoteRef);

        var remoteObjects = util.onRemote(remoteUrl)(objects.allObjects);
        remoteObjects.forEach(objects.write);

        gitty.update_ref(remoteRef, newHash);

        refs.write(
          "FETCH_HEAD",
          newHash + " branch " + branch + " of " + remoteUrl
        );

        return (
          [
            "From " + remoteUrl,
            "Count " + remoteObjects.length,
            branch +
              " -> " +
              remote +
              "/" +
              branch +
              (merge.isAForceFetch(oldHash, newHash) ? " (forced)" : ""),
          ].join("\n") + "\n"
        );
      }
    }
  },

  merge: function (ref, _) {
    files.assertInRepo();
    config.assertNotBare();

    var receiverHash = refs.hash("HEAD");

    var giverHash = refs.hash(ref);

    if (refs.isHeadDetached()) {
      throw new Error("unsupported");
    } else if (
      giverHash === undefined ||
      objects.type(objects.read(giverHash)) !== "commit"
    ) {
      throw new Error(ref + ": expected commit type");
    } else if (objects.isUpToDate(receiverHash, giverHash)) {
      return "Already up-to-date";
    } else {
      var paths = diff.changedFilesCommitWouldOverwrite(giverHash);
      if (paths.length > 0) {
        throw new Error(
          "local changes would be lost\n" + paths.join("\n") + "\n"
        );
      } else if (merge.canFastForward(receiverHash, giverHash)) {
        merge.writeFastForwardMerge(receiverHash, giverHash);
        return "Fast-forward";
      } else {
        merge.writeNonFastForwardMerge(receiverHash, giverHash, ref);

        if (merge.hasConflicts(receiverHash, giverHash)) {
          return "Automatic merge failed. Fix conflicts and commit the result.";
        } else {
          return gitty.commit();
        }
      }
    }
  },

  pull: function (remote, branch, _) {
    files.assertInRepo();
    config.assertNotBare();
    gitty.fetch(remote, branch);
    return gitty.merge("FETCH_HEAD");
  },

  push: function (remote, branch, opts) {
    files.assertInRepo();
    opts = opts || {};

    if (remote === undefined || branch === undefined) {
      throw new Error("unsupported");
    } else if (!(remote in config.read().remote)) {
      throw new Error(remote + " does not appear to be a git repository");
    } else {
      var remotePath = config.read().remote[remote].url;
      var remoteCall = util.onRemote(remotePath);

      if (remoteCall(refs.isCheckedOut, branch)) {
        throw new Error("refusing to update checked out branch " + branch);
      } else {
        var receiverHash = remoteCall(refs.hash, branch);

        var giverHash = refs.hash(branch);

        if (objects.isUpToDate(receiverHash, giverHash)) {
          return "Already up-to-date";
        } else if (!opts.f && !merge.canFastForward(receiverHash, giverHash)) {
          throw new Error("failed to push some refs to " + remotePath);
        } else {
          objects.allObjects().forEach(function (o) {
            remoteCall(objects.write, o);
          });

          remoteCall(gitty.update_ref, refs.toLocalRef(branch), giverHash);

          gitty.update_ref(refs.toRemoteRef(remote, branch), giverHash);

          return (
            [
              "To " + remotePath,
              "Count " + objects.allObjects().length,
              branch + " -> " + branch,
            ].join("\n") + "\n"
          );
        }
      }
    }
  },

  status: function (_) {
    files.assertInRepo();
    config.assertNotBare();
    return status.toString();
  },

  clone: function (remotePath, targetPath, opts) {
    opts = opts || {};

    if (remotePath === undefined || targetPath === undefined) {
      throw new Error("you must specify remote path and target path");
    } else if (
      !fs.existsSync(remotePath) ||
      !util.onRemote(remotePath)(files.inRepo)
    ) {
      throw new Error("repository " + remotePath + " does not exist");
    } else if (
      fs.existsSync(targetPath) &&
      fs.readdirSync(targetPath).length > 0
    ) {
      throw new Error(targetPath + " already exists and is not empty");
    } else {
      remotePath = nodePath.resolve(process.cwd(), remotePath);

      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath);
      }

      util.onRemote(targetPath)(function () {
        gitty.init(opts);

        gitty.remote(
          "add",
          "origin",
          nodePath.relative(process.cwd(), remotePath)
        );

        var remoteHeadHash = util.onRemote(remotePath)(refs.hash, "master");

        if (remoteHeadHash !== undefined) {
          gitty.fetch("origin", "master");
          merge.writeFastForwardMerge(undefined, remoteHeadHash);
        }
      });

      return "Cloning into " + targetPath;
    }
  },

  update_index: function (path, opts) {
    files.assertInRepo();
    config.assertNotBare();
    opts = opts || {};

    var pathFromRoot = files.pathFromRepoRoot(path);
    var isOnDisk = fs.existsSync(path);
    var isInIndex = index.hasFile(path, 0);

    if (isOnDisk && fs.statSync(path).isDirectory()) {
      throw new Error(pathFromRoot + " is a directory - add files inside\n");
    } else if (opts.remove && !isOnDisk && isInIndex) {
      if (index.isFileInConflict(path)) {
        throw new Error("unsupported");
      } else {
        index.writeRm(path);
        return "\n";
      }
    } else if (opts.remove && !isOnDisk && !isInIndex) {
      return "\n";
    } else if (!opts.add && isOnDisk && !isInIndex) {
      throw new Error(
        "cannot add " + pathFromRoot + " to index - use --add option\n"
      );
    } else if (isOnDisk && (opts.add || isInIndex)) {
      index.writeNonConflict(path, files.read(files.workingCopyPath(path)));
      return "\n";
    } else if (!opts.remove && !isOnDisk) {
      throw new Error(
        pathFromRoot + " does not exist and --remove not passed\n"
      );
    }
  },

  write_tree: function (_) {
    files.assertInRepo();
    return objects.writeTree(files.nestFlatTree(index.toc()));
  },

  update_ref: function (refToUpdate, refToUpdateTo, _) {
    files.assertInRepo();

    var hash = refs.hash(refToUpdateTo);

    if (!objects.exists(hash)) {
      throw new Error(refToUpdateTo + " not a valid SHA1");
    } else if (!refs.isRef(refToUpdate)) {
      throw new Error("cannot lock the ref " + refToUpdate);
    } else if (objects.type(objects.read(hash)) !== "commit") {
      var branch = refs.terminalRef(refToUpdate);
      throw new Error(
        branch + " cannot refer to non-commit object " + hash + "\n"
      );
    } else {
      refs.write(refs.terminalRef(refToUpdate), hash);
    }
  },
});

var parseOptions = function (argv) {
  var name;
  return argv.reduce(
    function (opts, arg) {
      if (arg.match(/^-/)) {
        name = arg.replace(/^-+/, "");
        opts[name] = true;
      } else if (name !== undefined) {
        opts[name] = arg;
        name = undefined;
      } else {
        opts._.push(arg);
      }

      return opts;
    },
    { _: [] }
  );
};

var runCli = (module.exports.runCli = function (argv) {
  var opts = parseOptions(argv);
  var commandName = opts._[2];

  if (commandName === undefined) {
    throw new Error("you must specify a gitty command to run");
  } else {
    var commandFnName = commandName.replace(/-/g, "_");
    var fn = gitty[commandFnName];

    if (fn === undefined) {
      throw new Error("'" + commandFnName + "' is not a gitty command");
    } else {
      var commandArgs = opts._.slice(3);
      while (commandArgs.length < fn.length - 1) {
        commandArgs.push(undefined);
      }

      return fn.apply(gitty, commandArgs.concat(opts));
    }
  }
});

if (require.main === module) {
  try {
    var result = runCli(process.argv);
    if (result !== undefined) {
      console.log(result);
    }
  } catch (e) {
    console.error(e.toString());
  }
}
