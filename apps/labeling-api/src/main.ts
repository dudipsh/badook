import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import * as fs from 'fs';
import { AppModule } from './app.module';

// Write GCP credentials file from env var (for Railway/Docker deployments)
if (process.env.GCP_CREDENTIALS_JSON) {
  const credPath = '/tmp/gcp-credentials.json';
  fs.writeFileSync(credPath, process.env.GCP_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  console.log('GCP credentials written to', credPath);
}

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: '10mb' }));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Labeling API running on http://localhost:${port}`);
};

bootstrap();
