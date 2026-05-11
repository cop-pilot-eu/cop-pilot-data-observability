import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class SubscriptionDataDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly id: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly type: string;
}

class AttributeDataDTO {
  @ApiProperty()
  @IsOptional()
  @IsString()
  readonly type: string;

  @ApiProperty()
  @IsOptional()
  readonly value: any;

  @ApiProperty()
  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => Date,
  )
  @IsDate()
  readonly observedAt: Date;
}

export class SubscriptionPayloadDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly id: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly type: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly subscriptionId: string;

  @IsNotEmpty()
  @Type(
    /* istanbul ignore next */
    () => Date,
  )
  @IsDate()
  @ApiProperty()
  readonly notifiedAt: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(
    /* istanbul ignore next */
    () => SubscriptionDataDTO,
  )
  readonly data: (SubscriptionDataDTO & Record<string, AttributeDataDTO>)[];
}

export type SubscriptionPayload = SubscriptionPayloadDTO;
