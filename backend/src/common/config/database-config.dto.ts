import { Expose } from 'class-transformer';
import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';

export class DatabaseConfigDTO {
  @IsOptional()
  @IsString()
  @IsIn(['postgres'])
  @Expose({ name: 'DB_TYPE' })
  public readonly type = 'postgres';

  @IsString()
  @Expose({ name: 'DB_HOST' })
  public readonly host!: string;

  @IsNumberString()
  @Expose({ name: 'DB_PORT' })
  public readonly port!: number;

  @IsString()
  @Expose({ name: 'DB_NAME' })
  public readonly databaseName!: string;

  @IsString()
  @Expose({ name: 'DB_USERNAME' })
  public readonly username!: string;

  @IsString()
  @Expose({ name: 'DB_PASSWORD' })
  public readonly password!: string;
}
