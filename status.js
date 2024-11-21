const util = require("./utils.js");
const files = require("./files.js");
const refs = require("./refs.js");
const index = require("./index.js");

var status = {
  toString: function () {
    function untracked() {
      return fs.readdirSync(files.workingCopyPath()).filter(function (p) {
        return index.toc()[p] === undefined && p !== ".gitty";
      });
    }

    function toBeCommitted() {
      var headHash = refs.hash("HEAD");
      var headToc = headHash === undefined ? {} : objects.commitToc(headHash);
      var ns = diff.nameStatus(diff.tocDiff(headToc, index.toc()));
      return Object.keys(ns).map(function (p) {
        return ns[p] + " " + p;
      });
    }

    function notStagedForCommit() {
      var ns = diff.nameStatus(diff.diff());
      return Object.keys(ns).map(function (p) {
        return ns[p] + " " + p;
      });
    }

    function listing(heading, lines) {
      return lines.length > 0 ? [heading, lines] : [];
    }

    return util
      .flatten([
        "On branch " + refs.headBranchName(),
        listing("Untracked files:", untracked()),
        listing("Unmerged paths:", index.conflictedPaths()),
        listing("Changes to be committed:", toBeCommitted()),
        listing("Changes not staged for commit:", notStagedForCommit()),
      ])
      .join("\n");
  },
};

module.exports = status
