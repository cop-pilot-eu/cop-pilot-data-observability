import { Inject, Logger } from '@nestjs/common';
import { getConfigToken, registerAs } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export async function readConfigFromEnv<T extends object>(constructor: {
  new (...args: unknown[]): T;
}) {
  const config = plainToInstance<T, unknown>(
    constructor as never,
    process.env,
    {
      excludeExtraneousValues: true, // this is needed to get just those variables that are defined in the class
      exposeDefaultValues: true, // this is needed to get default values from the class
    },
  );

  const errors = await validate(config);

  for (const error of errors) {
    Logger.error(error.toString());
  }

  if (errors.length > 0) {
    throw new Error(`Invalid config for ${constructor.name}`);
  }

  return config;
}

export class ConfigFactory {
  static create<T extends object>(
    name: string,
    constructor: {
      new (...args: unknown[]): T;
    },
  ) {
    return registerAs(name, async () => readConfigFromEnv(constructor));
  }
}

export const InjectConfig = (token: string | symbol) =>
  Inject(getConfigToken(token));
