import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class DataQualityReportDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly numberOfAttributes: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly numberOfRecords: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly totalMissingValues: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly completeness: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly avgLatencyMs: number;

  @IsNumber()
  @ApiProperty()
  readonly completenessDiffPercentage: number;

  @IsNumber()
  @ApiProperty()
  readonly avgLatencyDiffPercentage: number;
}
