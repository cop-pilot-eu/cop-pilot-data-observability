import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class LatencyDistributionReportDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => String,
  )
  @IsString()
  @ApiProperty()
  readonly bin: string;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsArray()
  @IsNumber({}, { each: true })
  @ApiProperty()
  readonly binEdges: number[];

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly latency: number;
}
