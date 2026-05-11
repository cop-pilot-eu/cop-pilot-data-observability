import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig, DatabaseConfigDTO, DBConfig } from './common';
import { ContextHistory } from './entities';
import { SnakeNamingStrategy } from './utils';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolve(process.cwd(), '.env'),
      load: [AppConfig, DBConfig],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [DBConfig.KEY],
      useFactory: (options: DatabaseConfigDTO) => ({
        type: options.type,
        host: options.host,
        port: options.port,
        username: options.username,
        password: options.password,
        database: options.databaseName,
        entities: [ContextHistory],
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),
      }),
    }),
    TypeOrmModule.forFeature([ContextHistory]),
    HttpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
