import { NestFactory } from '@nestjs/core';
import { WeathercollectorModule } from './weather-collector/weather-collector.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WeathercollectorModule);
}

bootstrap();
