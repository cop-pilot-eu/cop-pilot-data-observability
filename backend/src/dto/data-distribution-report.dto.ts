import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class DataDistributionReportDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => String,
  )
  @IsString()
  @ApiProperty()
  readonly attribute: string;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => String,
  )
  @IsString()
  @ApiProperty()
  readonly bin: string;

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsArray()
  @IsNumber({}, { each: true })
  @ApiProperty()
  readonly binEdges?: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly reference: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly analysis: number;
}
