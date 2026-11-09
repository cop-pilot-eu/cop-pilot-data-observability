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

  // The attribute's analysis values in this chunk: 'N/A' when non-numeric, null when the
  // chunk has none, absent on the derived <attr>_std / <attr>_count columns
  @IsOptional()
  @ValidateIf((o: ColumnDTO) => typeof o.min === 'number')
  @IsNumber()
  @ValidateIf((o: ColumnDTO) => typeof o.min === 'string')
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  readonly min?: number | string | null;

  @IsOptional()
  @ValidateIf((o: ColumnDTO) => typeof o.max === 'number')
  @IsNumber()
  @ValidateIf((o: ColumnDTO) => typeof o.max === 'string')
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  readonly max?: number | string | null;

  @IsOptional()
  @ValidateIf((o: ColumnDTO) => typeof o.mean === 'number')
  @IsNumber()
  @ValidateIf((o: ColumnDTO) => typeof o.mean === 'string')
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  readonly mean?: number | string | null;

  @IsOptional()
  @ValidateIf((o: ColumnDTO) => typeof o.outliers === 'number')
  @IsNumber()
  @ValidateIf((o: ColumnDTO) => typeof o.outliers === 'string')
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  readonly outliers?: number | string | null;
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
