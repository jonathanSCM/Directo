import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const proofMulterOptions = {
  storage: diskStorage({
    destination: UPLOADS_DIR,
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `proof_${randomUUID()}${ext}`);
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
      cb(
        new BadRequestException('Comprobante inválido (JPG, PNG, WEBP o PDF)'),
        false,
      );
    }
  },
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
};
