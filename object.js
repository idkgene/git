const util = require("./utils.js");
const files = require("./files.js");

var objects = {
  writeTree: function (tree) {
    var treeObject =
      Object.keys(tree)
        .map(function (key) {
          if (util.isString(tree[key])) {
            return "blob " + tree[key] + " " + key;
          } else {
            return "tree " + objects.writeTree(tree[key]) + " " + key;
          }
        })
        .join("\n") + "\n";

    return objects.write(treeObject);
  },

  fileTree: function (treeHash, tree) {
    if (tree === undefined) {
      return objects.fileTree(treeHash, {});
    }

    util.lines(objects.read(treeHash)).forEach(function (line) {
      var lineTokens = line.split(/ /);
      tree[lineTokens[2]] =
        lineTokens[0] === "tree"
          ? objects.fileTree(lineTokens[1], {})
          : lineTokens[1];
    });

    return tree;
  },

  writeCommit: function (treeHash, message, parentHashes) {
    return objects.write(
      "commit " +
        treeHash +
        "\n" +
        parentHashes
          .map(function (h) {
            return "parent " + h + "\n";
          })
          .join("") +
        "Date:  " +
        new Date().toString() +
        "\n" +
        "\n" +
        "    " +
        message +
        "\n"
    );
  },

  write: function (str) {
    files.write(
      nodePath.join(files.gittyPath(), "objects", util.hash(str)),
      str
    );
    return util.hash(str);
  },

  isUpToDate: function (receiverHash, giverHash) {
    return (
      receiverHash !== undefined &&
      (receiverHash === giverHash ||
        objects.isAncestor(receiverHash, giverHash))
    );
  },

  exists: function (objectHash) {
    return (
      objectHash !== undefined &&
      fs.existsSync(nodePath.join(files.gittyPath(), "objects", objectHash))
    );
  },

  read: function (objectHash) {
    if (objectHash !== undefined) {
      var objectPath = nodePath.join(files.gittyPath(), "objects", objectHash);
      if (fs.existsSync(objectPath)) {
        return files.read(objectPath);
      }
    }
  },

  allObjects: function () {
    return fs.readdirSync(files.gittyPath("objects")).map(objects.read);
  },

  type: function (str) {
    return (
      { commit: "commit", tree: "tree", blob: "tree" }[str.split(" ")[0]] ||
      "blob"
    );
  },

  isAncestor: function (descendentHash, ancestorHash) {
    return objects.ancestors(descendentHash).indexOf(ancestorHash) !== -1;
  },

  ancestors: function (commitHash) {
    var parents = objects.parentHashes(objects.read(commitHash));
    return util.flatten(parents.concat(parents.map(objects.ancestors)));
  },

  parentHashes: function (str) {
    if (objects.type(str) === "commit") {
      return str
        .split("\n")
        .filter(function (line) {
          return line.match(/^parent/);
        })
        .map(function (line) {
          return line.split(" ")[1];
        });
    }
  },

  treeHash: function (str) {
    if (objects.type(str) === "commit") {
      return str.split(/\s/)[1];
    }
  },

  commitToc: function (hash) {
    return files.flattenNestedTree(
      objects.fileTree(objects.treeHash(objects.read(hash)))
    );
  },
};

module.exports = objects;
