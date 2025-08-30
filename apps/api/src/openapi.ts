import { writeFileSync } from 'fs';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { ErrorDto } from './common/error.dto';

async function generate() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({ enableShutdownHooks: () => {} })
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const config = new DocumentBuilder()
    .setTitle('AfterLight API')
    .setDescription('MVP endpoints for vaults, verifiers, and verification events')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ErrorDto],
  });

  writeFileSync(
    join(__dirname, '..', 'openapi.json'),
    JSON.stringify(document, null, 2),
  );

  await app.close();
}

generate();
