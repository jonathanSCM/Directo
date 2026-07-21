import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UPLOADS_DIR } from './proof-multer.config';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 3 * 1024 * 1024;

export const qrImageMulterOptions = {
  storage: diskStorage({
    destination: UPLOADS_DIR,
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `qr_${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Imagen inválida (JPG, PNG o WEBP)'), false);
    }
  },
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
};
