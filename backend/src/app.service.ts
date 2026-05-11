import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APP_CONFIG_KEY, AppConfigDTO, InjectConfig } from './common';
import { CreateContextHistory, StatsPayloadDTO, StatsResponseDTO } from './dto';
import { ContextHistory, ContextHistoryType } from './entities';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(ContextHistory)
    private readonly repository: Repository<ContextHistory>,
    private readonly httpService: HttpService,
    @InjectConfig(APP_CONFIG_KEY) private readonly appConfig: AppConfigDTO,
  ) {}

  async retrieveStats(payload: StatsPayloadDTO): Promise<StatsResponseDTO> {
    return (
      await this.httpService.axiosRef.post<StatsResponseDTO>(
        `${this.appConfig.dataAnalyticsUrl}/calculate-stats`,
        payload,
      )
    ).data;
  }

  async retrieveEntities(): Promise<string[]> {
    const entityIds = await this.repository
      .createQueryBuilder('contextHistory')
      .select('contextHistory.entityId', 'id')
      .distinct(true)
      .getRawMany();
    return entityIds.map((entity: { id: string }) => entity.id);
  }

  async addContextHistory(
    data: CreateContextHistory,
  ): Promise<ContextHistoryType> {
    const contextHistory = this.repository.create(data);
    return this.repository.save(contextHistory);
  }
}
