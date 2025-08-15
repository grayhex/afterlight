import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Use global validation pipe for DTO validation if class-validator is added later
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }));
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT || 3000);
  Logger.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
