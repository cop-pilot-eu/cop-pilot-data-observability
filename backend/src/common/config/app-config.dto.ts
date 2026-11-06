import { Expose, Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class AppConfigDTO {
  @IsString()
  @Expose({ name: 'APP_NAME' })
  public readonly name!: string;

  @IsOptional()
  @IsIn(['production', 'development'])
  @Expose({ name: 'NODE_ENV' })
  private readonly env: 'production' | 'development' = 'development';

  @IsOptional()
  @IsString()
  @Expose({ name: 'APP_DESCRIPTION' })
  public readonly description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Expose({ name: 'PORT' })
  public readonly port: number = 3001;

  @IsString()
  @Expose({ name: 'FRONTEND_URL' })
  public readonly frontendUrl!: string;

  @IsString()
  @Expose({ name: 'DATA_ANALYTICS_URL' })
  public readonly dataAnalyticsUrl!: string;

  @IsString()
  @Expose({ name: 'NOTIFY_BASE_URL' })
  public readonly notifyBaseUrl!: string;

  // Namespaces subscription markers so a second deployment (dev) on the same
  // brokers never reconciles away prod's subscriptions. Empty in prod. No `:`
  // allowed — it is the marker separator.
  @IsOptional()
  @Matches(/^[a-z0-9-]*$/)
  @Expose({ name: 'SUBSCRIPTION_TAG' })
  public readonly subscriptionTag: string = '';

  @IsOptional()
  @IsIn(['true', 'false'])
  @Expose({ name: 'BROKER_SYNC_ENABLED' })
  private readonly brokerSync: 'true' | 'false' = 'false';

  get isProduction(): boolean {
    return this.env === 'production';
  }

  get brokerSyncEnabled(): boolean {
    return this.brokerSync === 'true';
  }

  get isDevelopment(): boolean {
    return this.env !== 'production';
  }
}
