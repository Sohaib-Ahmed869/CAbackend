const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype === "image/png" ||
      file.mimetype === "video/mp4"
    ) {
      cb(null, true);
    } else {
      const error = new Error("Only PDF and PNG files are allowed");
      error.status = 400; // Optional: Add a custom status code
      cb(error, false);
    }
  },
});

module.exports = upload;
