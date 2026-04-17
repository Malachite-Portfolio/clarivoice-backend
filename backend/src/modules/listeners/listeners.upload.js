const multer = require('multer');
const { AppError } = require('../../utils/appError');

const MAX_LISTENER_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_LISTENER_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_LISTENER_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const mimeType = String(file?.mimetype || '')
      .trim()
      .toLowerCase();

    if (!mimeType || !ALLOWED_LISTENER_UPLOAD_MIME_TYPES.has(mimeType)) {
      callback(
        new AppError(
          'Only JPG, PNG, or WEBP images are supported.',
          400,
          'INVALID_FILE_TYPE'
        )
      );
      return;
    }

    callback(null, true);
  },
});

const listenerImageUploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError(
            'Image too large. Please upload an image smaller than 8 MB.',
            400,
            'FILE_TOO_LARGE'
          )
        );
        return;
      }
      next(error);
      return;
    }

    if (!req.file?.buffer) {
      next(new AppError('Image file is required.', 400, 'FILE_MISSING'));
      return;
    }

    next();
  });
};

module.exports = {
  listenerImageUploadMiddleware,
  MAX_LISTENER_UPLOAD_BYTES,
  ALLOWED_LISTENER_UPLOAD_MIME_TYPES,
};
