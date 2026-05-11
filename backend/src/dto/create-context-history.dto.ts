import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateContextHistoryDTO {
  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Date,
  )
  @IsDate()
  @ApiProperty()
  readonly observedAt: Date;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Date,
  )
  @IsDate()
  @ApiProperty()
  readonly time: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly entityId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly entityType: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly attrName: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  readonly attrType: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  readonly value: any;

  @ApiProperty()
  @IsOptional()
  @IsString()
  readonly metadata: Record<string, any>;
}

export type CreateContextHistory = CreateContextHistoryDTO;
