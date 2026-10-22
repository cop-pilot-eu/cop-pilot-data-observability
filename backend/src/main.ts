import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig, AppConfigDTO } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const appConfig = app.get<AppConfigDTO>(AppConfig.KEY);
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: appConfig.frontendUrl,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Setup OpenAPI/Swagger
  if (appConfig.isDevelopment) {
    const options = new DocumentBuilder()
      .setTitle(appConfig.name)
      .setDescription(appConfig.description || '')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        docExpansion: false,
        defaultModelsExpandDepth: -1,
      },
    });
  }

  await app.listen(appConfig.port);
  logger.log(`Listening on port ${appConfig.port}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
