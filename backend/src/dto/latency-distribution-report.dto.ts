import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class LatencyBucketDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsInt()
  @ApiProperty()
  readonly count: number;

  // Observed latency range in the bucket; null when it has no responses
  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty({ nullable: true })
  readonly minMs: number | null;

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty({ nullable: true })
  readonly maxMs: number | null;
}

// Analysis responses per bucket, split at the reference median and p95.
export class LatencyDistributionReportDTO {
  @Type(
    /* istanbul ignore next */
    () => LatencyBucketDTO,
  )
  @IsObject()
  @ValidateNested()
  @ApiProperty()
  readonly normalResponse: LatencyBucketDTO;

  @Type(
    /* istanbul ignore next */
    () => LatencyBucketDTO,
  )
  @IsObject()
  @ValidateNested()
  @ApiProperty()
  readonly slowerThanUsualResponse: LatencyBucketDTO;

  @Type(
    /* istanbul ignore next */
    () => LatencyBucketDTO,
  )
  @IsObject()
  @ValidateNested()
  @ApiProperty()
  readonly unacceptablySlowResponse: LatencyBucketDTO;
}
