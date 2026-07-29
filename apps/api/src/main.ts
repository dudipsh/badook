import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

if (process.env.GCP_CREDENTIALS_JSON) {
  const credPath = '/tmp/gcp-credentials.json';
  fs.writeFileSync(credPath, process.env.GCP_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  console.log('GCP credentials written to', credPath);
}

async function bootstrap() {
  // Apply pending migrations (safe — only runs existing migration files, never drops data)
  try {
    console.log('Running prisma migrate deploy...');
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      stdio: 'inherit',
      cwd: __dirname.includes('/dist/') ? __dirname.replace(/\/dist\/.*/, '') : process.cwd(),
    });
    console.log('Migrations complete.');
  } catch (e) {
    console.error('Migration failed (non-fatal):', e);
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Trust reverse proxy headers (Railway, Render, etc.) so req.protocol returns 'https'
  // Required for Twilio webhook signature verification
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3001;
  await app.listen(port);
  const buildTime = new Date().toISOString();
  console.log(`API running on http://localhost:${port} | started: ${buildTime} | swap-logic: REMOVED`);
}

bootstrap();
