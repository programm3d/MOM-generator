import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';
import { tempStorage } from '../utils/temp-storage.js';
import { config } from '../config/index.js';

const ALLOWED_EXTENSIONS = new Set(['.docx', '.pdf', '.txt']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    tempStorage.ensureDirectory();
    cb(null, config.tempDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const { filePath } = tempStorage.generateFilePath(ext);
    cb(null, path.basename(filePath));
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    (req as any).fileValidationError = `Unsupported file type "${ext}". Supported types are .docx, .pdf, and .txt.`;
    return cb(null, false);
  }
  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.uploadMaxMb * 1024 * 1024,
    files: 1,
  },
});
