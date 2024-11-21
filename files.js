const util = require('./utils.js');

var files = {
  inRepo: function () {
    return files.gittyPath() !== undefined;
  },

  assertInRepo: function () {
    if (!files.inRepo()) {
      throw new Error("not a gitty repository");
    }
  },

  pathFromRepoRoot: function (path) {
    return nodePath.relative(
      files.workingCopyPath(),
      nodePath.join(process.cwd(), path)
    );
  },

  write: function (path, content) {
    var prefix = require("os").platform() == "win32" ? "." : "/";
    files.writeFilesFromTree(
      util.setIn({}, path.split(nodePath.sep).concat(content)),
      prefix
    );
  },

  writeFilesFromTree: function (tree, prefix) {
    Object.keys(tree).forEach(function (name) {
      var path = nodePath.join(prefix, name);
      if (util.isString(tree[name])) {
        fs.writeFileSync(path, tree[name]);
      } else {
        if (!fs.existsSync(path)) {
          fs.mkdirSync(path, "777");
        }

        files.writeFilesFromTree(tree[name], path);
      }
    });
  },

  rmEmptyDirs: function (path) {
    if (fs.statSync(path).isDirectory()) {
      fs.readdirSync(path).forEach(function (c) {
        files.rmEmptyDirs(nodePath.join(path, c));
      });
      if (fs.readdirSync(path).length === 0) {
        fs.rmdirSync(path);
      }
    }
  },

  read: function (path) {
    if (fs.existsSync(path)) {
      return fs.readFileSync(path, "utf8");
    }
  },

  gittyPath: function (path) {
    function gittyDir(dir) {
      if (fs.existsSync(dir)) {
        var potentialConfigFile = nodePath.join(dir, "config");
        var potentialgittyPath = nodePath.join(dir, ".gitty");
        if (
          fs.existsSync(potentialConfigFile) &&
          fs.statSync(potentialConfigFile).isFile() &&
          files.read(potentialConfigFile).match(/\[core\]/)
        ) {
          return dir;
        } else if (fs.existsSync(potentialgittyPath)) {
          return potentialgittyPath;
        } else if (dir !== "/") {
          return gittyDir(nodePath.join(dir, ".."));
        }
      }
    }

    var gDir = gittyDir(process.cwd());
    if (gDir !== undefined) {
      return nodePath.join(gDir, path || "");
    }
  },

  workingCopyPath: function (path) {
    return nodePath.join(nodePath.join(files.gittyPath(), ".."), path || "");
  },

  lsRecursive: function (path) {
    if (!fs.existsSync(path)) {
      return [];
    } else if (fs.statSync(path).isFile()) {
      return [path];
    } else if (fs.statSync(path).isDirectory()) {
      return fs.readdirSync(path).reduce(function (fileList, dirChild) {
        return fileList.concat(
          files.lsRecursive(nodePath.join(path, dirChild))
        );
      }, []);
    }
  },

  nestFlatTree: function (obj) {
    return Object.keys(obj).reduce(function (tree, wholePath) {
      return util.setIn(
        tree,
        wholePath.split(nodePath.sep).concat(obj[wholePath])
      );
    }, {});
  },

  flattenNestedTree: function (tree, obj, prefix) {
    if (obj === undefined) {
      return files.flattenNestedTree(tree, {}, "");
    }

    Object.keys(tree).forEach(function (dir) {
      var path = nodePath.join(prefix, dir);
      if (util.isString(tree[dir])) {
        obj[path] = tree[dir];
      } else {
        files.flattenNestedTree(tree[dir], obj, path);
      }
    });

    return obj;
  },
};

module.exports = files
