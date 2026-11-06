import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AttributeQualityReportDTO } from './attribute-quality-report.dto';
import { DataDistributionReportDTO } from './data-distribution-report.dto';
import { DataDriftReportDTO } from './data-drift-report.dto';
import { DataDriftSummaryDTO } from './data-drift-summary.dto';
import { DataQualityReportDTO } from './data-quality-report.dto';
import { LatencyDistributionReportDTO } from './latency-distribution-report.dto';
import { ResponseTimesReportDTO } from './response-times-report.dto';

export class StatsResponseDTO {
  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => DataQualityReportDTO,
  )
  @IsObject()
  @ApiProperty()
  readonly dataQualityReport?: DataQualityReportDTO;

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => AttributeQualityReportDTO,
  )
  @IsObject()
  @ValidateNested({ each: true })
  @ApiProperty()
  readonly attributeQualityReport?: Record<string, AttributeQualityReportDTO>;

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => DataDriftReportDTO,
  )
  @IsArray()
  @ValidateNested({ each: true })
  @ApiProperty()
  readonly dataDriftReport?: DataDriftReportDTO[];

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => DataDistributionReportDTO,
  )
  @IsArray()
  @ValidateNested({ each: true })
  @ApiProperty()
  readonly dataDistributionReport?: DataDistributionReportDTO[];

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => DataDriftSummaryDTO,
  )
  @IsArray()
  @ValidateNested({ each: true })
  @ApiProperty()
  readonly dataDriftSummary?: DataDriftSummaryDTO[];

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => LatencyDistributionReportDTO,
  )
  @IsArray()
  @ValidateNested({ each: true })
  @ApiProperty()
  readonly latencyDistributionReport?: LatencyDistributionReportDTO[];

  @IsOptional()
  @Type(
    /* istanbul ignore next */
    () => ResponseTimesReportDTO,
  )
  @IsArray()
  @ValidateNested({ each: true })
  @ApiProperty()
  readonly responseTimesReport?: ResponseTimesReportDTO[];

  // Why the reports are empty, e.g. reference range not complete yet.
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly message?: string;
}

export type StatsResponse = StatsResponseDTO;
