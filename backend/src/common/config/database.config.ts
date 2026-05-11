import { ConfigFactory } from '../factories';
import { DatabaseConfigDTO } from './database-config.dto';

export const DB_CONFIG_KEY = 'db';
export const DBConfig = ConfigFactory.create(DB_CONFIG_KEY, DatabaseConfigDTO);
