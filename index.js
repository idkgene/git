const util = require("./utils.js");
const files = require("./files.js");
const objects = require("./objects.js");

var index = {
  hasFile: function (path, stage) {
    return index.read()[index.key(path, stage)] !== undefined;
  },

  read: function () {
    var indexFilePath = files.gittyPath("index");
    return util
      .lines(fs.existsSync(indexFilePath) ? files.read(indexFilePath) : "\n")
      .reduce(function (idx, blobStr) {
        var blobData = blobStr.split(/ /);
        idx[index.key(blobData[0], blobData[1])] = blobData[2];
        return idx;
      }, {});
  },

  key: function (path, stage) {
    return path + "," + stage;
  },

  keyPieces: function (key) {
    var pieces = key.split(/,/);
    return { path: pieces[0], stage: parseInt(pieces[1]) };
  },

  toc: function () {
    var idx = index.read();
    return Object.keys(idx).reduce(function (obj, k) {
      return util.setIn(obj, [k.split(",")[0], idx[k]]);
    }, {});
  },

  isFileInConflict: function (path) {
    return index.hasFile(path, 2);
  },

  conflictedPaths: function () {
    var idx = index.read();
    return Object.keys(idx)
      .filter(function (k) {
        return index.keyPieces(k).stage === 2;
      })
      .map(function (k) {
        return index.keyPieces(k).path;
      });
  },

  writeNonConflict: function (path, content) {
    index.writeRm(path);

    index._writeStageEntry(path, 0, content);
  },

  writeConflict: function (path, receiverContent, giverContent, baseContent) {
    if (baseContent !== undefined) {
      index._writeStageEntry(path, 1, baseContent);
    }

    index._writeStageEntry(path, 2, receiverContent);

    index._writeStageEntry(path, 3, giverContent);
  },

  writeRm: function (path) {
    var idx = index.read();
    [0, 1, 2, 3].forEach(function (stage) {
      delete idx[index.key(path, stage)];
    });
    index.write(idx);
  },

  _writeStageEntry: function (path, stage, content) {
    var idx = index.read();
    idx[index.key(path, stage)] = objects.write(content);
    index.write(idx);
  },

  write: function (index) {
    var indexStr =
      Object.keys(index)
        .map(function (k) {
          return k.split(",")[0] + " " + k.split(",")[1] + " " + index[k];
        })
        .join("\n") + "\n";
    files.write(files.gittyPath("index"), indexStr);
  },

  workingCopyToc: function () {
    return Object.keys(index.read())
      .map(function (k) {
        return k.split(",")[0];
      })
      .filter(function (p) {
        return fs.existsSync(files.workingCopyPath(p));
      })
      .reduce(function (idx, p) {
        idx[p] = util.hash(files.read(files.workingCopyPath(p)));
        return idx;
      }, {});
  },

  tocToIndex: function (toc) {
    return Object.keys(toc).reduce(function (idx, p) {
      return util.setIn(idx, [index.key(p, 0), toc[p]]);
    }, {});
  },

  matchingFiles: function (pathSpec) {
    var searchPath = files.pathFromRepoRoot(pathSpec);
    return Object.keys(index.toc()).filter(function (p) {
      return p.match("^" + searchPath.replace(/\\/g, "\\\\"));
    });
  },
};

module.exports = index
