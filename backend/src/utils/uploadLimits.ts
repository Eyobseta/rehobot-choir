// backend/src/utils/uploadLimits.ts
//
// Shared multer helpers. Every file is held in the server's RAM until it is
// sent to Cloudinary (memoryStorage), so these limits protect the Render free
// instance (512 MB) and give members a clear message instead of a generic 500.
//
// Chat has its own equivalent in chat.routes.ts and does not use this file.

import multer from 'multer';
import type { RequestHandler } from 'express';
import { ApiError } from './ApiError';

const MB = 1024 * 1024;

function isAudioMime(mime: string): boolean {
  return (
    mime.startsWith('audio/') ||
    mime === 'video/mp4' || // some phones label .m4a files like this
    mime === 'video/3gpp' ||
    mime === 'application/octet-stream' // Cloudinary still rejects non-media files
  );
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function build(maxFileMb: number, maxFiles: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileMb * MB, files: maxFiles },
    fileFilter: (_req, file, cb) => {
      const mime = (file.mimetype || '').toLowerCase();
      if (file.fieldname === 'audio') {
        if (!isAudioMime(mime)) {
          return cb(ApiError.badRequest('Unsupported audio format.', 'BAD_AUDIO_TYPE'));
        }
        return cb(null, true);
      }
      if (file.fieldname === 'photos') {
        if (!isImageMime(mime)) {
          return cb(ApiError.badRequest('Only image files are allowed.', 'BAD_IMAGE_TYPE'));
        }
        return cb(null, true);
      }
      return cb(ApiError.badRequest('Unexpected file field.', 'BAD_FILE_FIELD'));
    },
  });
}

/** Turn multer errors into our standard { status, code, message } shape. */
function withFriendlyErrors(mw: RequestHandler, maxFileMb: number): RequestHandler {
  return (req, res, next) => {
    mw(req, res, (err?: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new ApiError(413, 'FILE_TOO_LARGE', `A file is too large (max ${maxFileMb} MB each).`),
          );
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(ApiError.badRequest('Too many files or an unexpected file field.'));
        }
        return next(ApiError.badRequest(err.message));
      }
      return next(err);
    });
  };
}

/** One optional audio file in the field "audio" (songs, Zema, daily quote). */
export function singleAudioUpload(maxFileMb: number): RequestHandler {
  return withFriendlyErrors(build(maxFileMb, 1).single('audio'), maxFileMb);
}

/** Up to `maxPhotos` photos in "photos" plus one audio file in "audio" (memories). */
export function memoryMediaUpload(maxFileMb = 8, maxPhotos = 20): RequestHandler {
  return withFriendlyErrors(
    build(maxFileMb, maxPhotos + 1).fields([
      { name: 'photos', maxCount: maxPhotos },
      { name: 'audio', maxCount: 1 },
    ]),
    maxFileMb,
  );
}
