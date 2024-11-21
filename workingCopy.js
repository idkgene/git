const files = require("./files.js");
const objects = require("./objects.js");

var workingCopy = {
  write: function (dif) {
    function composeConflict(receiverFileHash, giverFileHash) {
      return (
        "<<<<<<\n" +
        objects.read(receiverFileHash) +
        "\n======\n" +
        objects.read(giverFileHash) +
        "\n>>>>>>\n"
      );
    }

    Object.keys(dif).forEach(function (p) {
      if (dif[p].status === diff.FILE_STATUS.ADD) {
        files.write(
          files.workingCopyPath(p),
          objects.read(dif[p].receiver || dif[p].giver)
        );
      } else if (dif[p].status === diff.FILE_STATUS.CONFLICT) {
        files.write(
          files.workingCopyPath(p),
          composeConflict(dif[p].receiver, dif[p].giver)
        );
      } else if (dif[p].status === diff.FILE_STATUS.MODIFY) {
        files.write(files.workingCopyPath(p), objects.read(dif[p].giver));
      } else if (dif[p].status === diff.FILE_STATUS.DELETE) {
        fs.unlinkSync(files.workingCopyPath(p));
      }
    });

    fs.readdirSync(files.workingCopyPath())
      .filter(function (n) {
        return n !== ".gitty";
      })
      .forEach(files.rmEmptyDirs);
  },
};

module.exports = workingCopy
