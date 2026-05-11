import { ConfigFactory } from '../factories';
import { AppConfigDTO } from './app-config.dto';

export const APP_CONFIG_KEY = 'app';
export const AppConfig = ConfigFactory.create(APP_CONFIG_KEY, AppConfigDTO);
