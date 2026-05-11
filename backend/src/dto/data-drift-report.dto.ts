import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class ColumnDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => String,
  )
  @IsString()
  @ApiProperty()
  readonly name: string;

  @IsOptional()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'number')
  @IsNumber()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'string')
  @IsString()
  @ApiProperty()
  readonly value?: number | string;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => String,
  )
  @IsString()
  @ApiProperty()
  readonly metric: string;

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly lowerThreshold?: number;

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

export class DataDriftReportDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly chunkIndex: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => String,
  )
  @IsString()
  @ApiProperty()
  readonly chunkKey: string;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly chunkStartIndex: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly chunkEndIndex: number;

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
  readonly chunkPeriod: string;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => ColumnDTO,
  )
  @IsArray()
  @ValidateNested({ each: true })
  @ApiProperty()
  readonly columns: ColumnDTO[];
}
