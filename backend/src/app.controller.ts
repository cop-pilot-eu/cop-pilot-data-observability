/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { omit } from 'ramda';
import { QueryFailedError } from 'typeorm';
import { AppService } from './app.service';
import {
  CreateContextHistoryDTO,
  StatsPayloadDTO,
  StatsResponse,
  SubscriptionPayloadDTO,
} from './dto';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly appService: AppService) {}

  @Post('stats')
  @ApiOperation({ summary: 'Retrieve data observability stats' })
  async retrieveStats(
    @Body() payload: StatsPayloadDTO,
  ): Promise<StatsResponse> {
    return this.appService.retrieveStats(payload);
  }

  @Post('subscription')
  @ApiOperation({ summary: '' })
  async createContextHistory(@Body() payload: SubscriptionPayloadDTO) {
    this.logger.debug(
      `Received subscription payload: ${JSON.stringify(payload, null, 2)}`,
    );
    for (const data of payload.data) {
      for (const [key, value] of Object.entries(data)) {
        if (!['id', 'type'].includes(key) && value.observedAt) {
          try {
            const contextHistory: CreateContextHistoryDTO = {
              observedAt: value.observedAt,
              time: payload.notifiedAt,
              entityId: data.id,
              entityType: data.type,
              attrName: key,
              attrType: value.type,
              value: value.value,
              metadata: omit(['type', 'value', 'observedAt'], value),
            };
            this.logger.log(
              `Adding context history: ${String(contextHistory.observedAt)}, ${contextHistory.entityId}, ${contextHistory.attrName}`,
            );
            await this.appService.addContextHistory(contextHistory);
            this.logger.log('Context history added successfully.');
          } catch (error: unknown) {
            if (error instanceof QueryFailedError) {
              this.logger.error(
                'QueryFailedError: Failed to add context history: ',
                error.message,
              );
            } else {
              this.logger.error('Failed to add context history: ', error);
            }
          }
        }
      }
    }
  }

  @Get('entities')
  @ApiOperation({ summary: 'Retrieve entities' })
  async retrieveEntities(): Promise<string[]> {
    return this.appService.retrieveEntities();
  }
}
