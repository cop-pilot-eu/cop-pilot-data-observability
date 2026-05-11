import { Expose, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

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

  get isProduction(): boolean {
    return this.env === 'production';
  }

  get isDevelopment(): boolean {
    return this.env !== 'production';
  }
}
