const utils = {
  isString: function (thing) {
    return typeof thing === "string";
  },

  hash: function (string) {
    var hashInt = 0;
    for (var i = 0; i < string.length; i++) {
      hashInt = hashInt * 31 + string.charCodeAt(i);
      hashInt = hashInt | 0;
    }
    return Math.abs(hashInt).toString(16);
  },

  setIn: function (obj, arr) {
    if (arr.length === 2) {
      obj[arr[0]] = arr[1];
    } else if (arr.length > 2) {
      obj[arr[0]] = obj[arr[0]] || {};
      utils.setIn(obj[arr[0]], arr.slice(1));
    }
    return obj;
  },

  lines: function (str) {
    return str.split("\n").filter(function (l) {
      return l !== "";
    });
  },

  flatten: function (arr) {
    return arr.reduce(function (a, e) {
      return a.concat(e instanceof Array ? utils.flatten(e) : e);
    }, []);
  },

  unique: function (arr) {
    return arr.reduce(function (a, p) {
      return a.indexOf(p) === -1 ? a.concat(p) : a;
    }, []);
  },

  intersection: function (a, b) {
    return a.filter(function (e) {
      return b.indexOf(e) !== -1;
    });
  },

  onRemote: function (remotePath) {
    return function (fn) {
      var originalDir = process.cwd();
      process.chdir(remotePath);
      var result = fn.apply(null, Array.prototype.slice.call(arguments, 1));
      process.chdir(originalDir);
      return result;
    };
  },
};

module.exports = utils;
