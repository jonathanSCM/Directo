import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'fs';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { UPLOADS_DIR } from './modules/properties/multer.config';

function resolveCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw || raw === '*') return true; // sin restricción (dev/no configurado)
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

async function bootstrap() {
  // El login del panel admin ahora se autentica con una cookie httpOnly
  // (credentials: true). Combinado con un CORS abierto (sin CORS_ORIGINS),
  // el navegador reenviaría esa cookie a CUALQUIER sitio que llame a la API
  // — es una condición insegura, no solo una mala práctica. En producción
  // es obligatorio fijar CORS_ORIGINS a la lista real de dominios.
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS.trim() === '*')
  ) {
    throw new Error(
      'CORS_ORIGINS debe estar configurado en producción (no puede quedar abierto): ' +
        'las cookies de sesión del admin se reenviarían a cualquier origen.',
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: resolveCorsOrigin(),
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    },
  });
  const config = app.get(ConfigService);

  const prefix = config.get<string>('API_PREFIX') ?? 'api';
  app.setGlobalPrefix(prefix);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Archivos subidos (§6.2): se sirven en /uploads
  mkdirSync(UPLOADS_DIR, { recursive: true });
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads/' });

  // Swagger / OpenAPI (§20)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Inmobiliaria MVP API')
    .setDescription('API REST de la plataforma web inmobiliaria (MVP DIRECTO).')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document);

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);

  const url = await app.getUrl();
  // eslint-disable-next-line no-console
  console.log(`🚀 API lista en ${url}/${prefix}  ·  Swagger: ${url}/${prefix}/docs`);
}

void bootstrap();
