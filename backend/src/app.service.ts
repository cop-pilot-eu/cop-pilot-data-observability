import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CLUSTER_TITLES, getBrokerTitle } from './brokers/brokers.const';
import { ClusterId, SelectOption } from './brokers/brokers.types';
import { APP_CONFIG_KEY, AppConfigDTO, InjectConfig } from './common';
import { CreateContextHistory, StatsPayloadDTO, StatsResponseDTO } from './dto';
import { Broker, ContextHistory } from './entities';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectRepository(ContextHistory)
    private readonly repository: Repository<ContextHistory>,
    @InjectRepository(Broker)
    private readonly brokerRepository: Repository<Broker>,
    private readonly httpService: HttpService,
    @InjectConfig(APP_CONFIG_KEY) private readonly appConfig: AppConfigDTO,
  ) {}

  async retrieveStats(payload: StatsPayloadDTO): Promise<StatsResponseDTO> {
    this.logger.log(
      `Retrieving data for cluster: ${payload.clusterId}, broker: ${payload.brokerId}`,
    );

    return (
      await this.httpService.axiosRef.post<StatsResponseDTO>(
        `${this.appConfig.dataAnalyticsUrl}/calculate-stats`,
        payload,
      )
    ).data;
  }

  async retrieveClusters(): Promise<SelectOption[]> {
    this.logger.log('Retrieving clusters');
    const clusters = await this.brokerRepository
      .createQueryBuilder('broker')
      .select('broker.org', 'org')
      .addSelect('broker.clusterId', 'clusterId')
      .distinct(true)
      .orderBy('broker.clusterId', 'ASC')
      .getRawMany();
    return clusters.map((cluster: { org: string; clusterId: ClusterId }) => ({
      title: CLUSTER_TITLES[cluster.clusterId] ?? cluster.org,
      value: cluster.org,
    }));
  }

  async retrieveBrokersByCluster(org: string): Promise<SelectOption[]> {
    this.logger.log(`Retrieving brokers for cluster: ${org}`);
    const brokers = await this.brokerRepository
      .createQueryBuilder('broker')
      .select('broker.id', 'id')
      .addSelect('broker.clusterId', 'clusterId')
      .where('broker.org = :org', { org })
      .orderBy('broker.id', 'ASC')
      .getRawMany();
    return brokers.map((broker: { id: string; clusterId: ClusterId }) => ({
      title: getBrokerTitle(broker.id, broker.clusterId),
      value: broker.id,
    }));
  }

  async retrieveEntitiesByBroker(brokerId: string): Promise<string[]> {
    this.logger.log(`Retrieving entities for broker: ${brokerId}`);
    const entityIds = await this.repository
      .createQueryBuilder('contextHistory')
      .select('contextHistory.entityId', 'id')
      .distinct(true)
      .where('contextHistory.brokerId = :brokerId', { brokerId })
      .orderBy('contextHistory.entityId', 'ASC')
      .getRawMany();
    return entityIds.map((entity: { id: string }) => entity.id);
  }

  async insertContextHistory(rows: CreateContextHistory[]): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(ContextHistory)
      .values(rows)
      .orIgnore()
      .execute();
  }
}
