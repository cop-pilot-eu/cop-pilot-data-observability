import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from './utils';

if (process.env.NODE_ENV !== 'production')
  dotenv.config({ path: resolve(__dirname, '..', '.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT as string, 10),
  database: process.env.DB_NAME,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [resolve(__dirname, 'entities/index.ts')],
  migrations: [
    resolve(__dirname, 'migrations', '*.ts'),
    resolve(__dirname, 'migrations', '*.js'),
  ],
});
