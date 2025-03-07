const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "video/mp4"||
      file.mimetype === "video/quicktime"
    ) {
      cb(null, true);
    } else {
      const error = new Error("Only PDF, PNG, JPG, DOCX, and MP4 files are allowed");
      error.status = 404; 
      cb(error, false);
    }
  },
});

module.exports = upload;
