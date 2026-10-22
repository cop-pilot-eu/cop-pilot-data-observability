import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

export class StatsPayloadDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Date,
  )
  @IsDate()
  @ApiProperty()
  readonly from: Date;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Date,
  )
  @IsDate()
  @ApiProperty()
  readonly to: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly clusterId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly brokerId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly entityId: string;
}
