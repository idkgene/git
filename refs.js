const util = require("./utils.js");
const files = require("./files.js");

var refs = {
  isRef: function (ref) {
    return (
      ref !== undefined &&
      (ref.match("^refs/heads/[A-Za-z-]+$") ||
        ref.match("^refs/remotes/[A-Za-z-]+/[A-Za-z-]+$") ||
        ["HEAD", "FETCH_HEAD", "MERGE_HEAD"].indexOf(ref) !== -1)
    );
  },

  terminalRef: function (ref) {
    if (ref === "HEAD" && !refs.isHeadDetached()) {
      return files
        .read(files.gittyPath("HEAD"))
        .match("ref: (refs/heads/.+)")[1];
    } else if (refs.isRef(ref)) {
      return ref;
    } else {
      return refs.toLocalRef(ref);
    }
  },

  hash: function (refOrHash) {
    if (objects.exists(refOrHash)) {
      return refOrHash;
    } else {
      var terminalRef = refs.terminalRef(refOrHash);
      if (terminalRef === "FETCH_HEAD") {
        return refs.fetchHeadBranchToMerge(refs.headBranchName());
      } else if (refs.exists(terminalRef)) {
        return files.read(files.gittyPath(terminalRef));
      }
    }
  },

  isHeadDetached: function () {
    return files.read(files.gittyPath("HEAD")).match("refs") === null;
  },

  isCheckedOut: function (branch) {
    return !config.isBare() && refs.headBranchName() === branch;
  },

  toLocalRef: function (name) {
    return "refs/heads/" + name;
  },

  toRemoteRef: function (remote, name) {
    return "refs/remotes/" + remote + "/" + name;
  },

  write: function (ref, content) {
    if (refs.isRef(ref)) {
      files.write(files.gittyPath(nodePath.normalize(ref)), content);
    }
  },

  rm: function (ref) {
    if (refs.isRef(ref)) {
      fs.unlinkSync(files.gittyPath(ref));
    }
  },

  fetchHeadBranchToMerge: function (branchName) {
    return util
      .lines(files.read(files.gittyPath("FETCH_HEAD")))
      .filter(function (l) {
        return l.match("^.+ branch " + branchName + " of");
      })
      .map(function (l) {
        return l.match("^([^ ]+) ")[1];
      })[0];
  },

  localHeads: function () {
    return fs
      .readdirSync(nodePath.join(files.gittyPath(), "refs", "heads"))
      .reduce(function (o, n) {
        return util.setIn(o, [n, refs.hash(n)]);
      }, {});
  },

  exists: function (ref) {
    return refs.isRef(ref) && fs.existsSync(files.gittyPath(ref));
  },

  headBranchName: function () {
    if (!refs.isHeadDetached()) {
      return files.read(files.gittyPath("HEAD")).match("refs/heads/(.+)")[1];
    }
  },

  commitParentHashes: function () {
    var headHash = refs.hash("HEAD");

    if (merge.isMergeInProgress()) {
      return [headHash, refs.hash("MERGE_HEAD")];
    } else if (headHash === undefined) {
      return [];
    } else {
      return [headHash];
    }
  },
};

module.exports = refs
