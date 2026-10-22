import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { getBroker } from './brokers/brokers.const';
import { SelectOption } from './brokers/brokers.types';
import { parseNotification } from './brokers/notification.parser';
import { StatsPayloadDTO, StatsResponse } from './dto';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get('clusters')
  @ApiOperation({ summary: 'Retrieve clusters' })
  retrieveClusters(): Promise<SelectOption[]> {
    return this.appService.retrieveClusters();
  }

  @Get('brokers/:org')
  @ApiOperation({ summary: 'Retrieve brokers by cluster' })
  retrieveBrokersByCluster(@Param('org') org: string): Promise<SelectOption[]> {
    return this.appService.retrieveBrokersByCluster(org);
  }

  @Post('stats')
  @ApiOperation({ summary: 'Retrieve data observability stats' })
  async retrieveStats(
    @Body() payload: StatsPayloadDTO,
  ): Promise<StatsResponse> {
    return this.appService.retrieveStats(payload);
  }

  @Post('subscriptions/:brokerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive a broker notification' })
  async createContextHistory(
    @Param('brokerId') brokerId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const broker = getBroker(brokerId);
    if (!broker) throw new NotFoundException(`Unknown broker: ${brokerId}`);
    const data =
      (body as { data?: { id?: unknown; type?: unknown }[] })?.data ?? [];
    for (const entity of data) {
      this.logger.debug(
        `[${brokerId}] incoming payload from ${String(entity.id)}, ${String(entity.type)}`,
      );
    }
    const rows = parseNotification(broker, body, new Date());
    if (rows.length) await this.appService.insertContextHistory(rows);
  }

  @Get('entities/:brokerId')
  @ApiOperation({ summary: 'Retrieve entities by broker' })
  retrieveEntitiesByBroker(
    @Param('brokerId') brokerId: string,
  ): Promise<string[]> {
    return this.appService.retrieveEntitiesByBroker(brokerId);
  }
}
