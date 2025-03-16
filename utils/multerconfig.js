const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const disallowedTypes = [
      "application/x-msdownload",
      "application/x-msdos-program",
    ];
    if (disallowedTypes.includes(file.mimetype)) {
      const error = new Error("DLL and EXE files are not allowed");
      error.status = 404;
      cb(error, false);
    } else {
      cb(null, true);
    }
  },
});

module.exports = upload;
