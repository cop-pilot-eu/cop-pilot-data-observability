import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, ValidateIf } from 'class-validator';

export class AttributeQualityReportDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => String,
  )
  @IsString()
  @ApiProperty()
  readonly dtype: string;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly count: number;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Number,
  )
  @IsNumber()
  @ApiProperty()
  readonly missing: number;

  @IsNotEmpty()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'number')
  @IsNumber()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'string')
  @IsString()
  @ApiProperty()
  readonly mean: number | string;

  @IsNotEmpty()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'number')
  @IsNumber()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'string')
  @IsString()
  @ApiProperty()
  readonly min: number | string;

  @IsNotEmpty()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'number')
  @IsNumber()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'string')
  @IsString()
  @ApiProperty()
  readonly max: number | string;

  @IsNotEmpty()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'number')
  @IsNumber()
  @ValidateIf((o: { value: number | string }) => typeof o.value === 'string')
  @IsString()
  @ApiProperty()
  readonly outliers: number | string;
}
