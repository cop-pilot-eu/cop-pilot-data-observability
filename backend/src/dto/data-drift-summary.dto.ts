import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class DataDriftSummaryDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Date,
  )
  @IsDate()
  @ApiProperty()
  readonly chunkStartDate: Date;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Date,
  )
  @IsDate()
  @ApiProperty()
  readonly chunkEndDate: Date;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => String,
  )
  @IsString()
  @ApiProperty()
  readonly name: string;

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly value?: number;

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly upperThreshold?: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Boolean,
  )
  @IsBoolean()
  @ApiProperty()
  readonly alert: boolean;
}
