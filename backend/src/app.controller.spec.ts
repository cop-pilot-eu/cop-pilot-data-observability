import { AppController } from './app.controller';
import { StatsPayloadDTO, StatsResponse } from './dto';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: any;

  beforeEach(() => {
    mockAppService = {
      retrieveClusters: jest.fn(),
      retrieveStats: jest.fn(),
      retrieveBrokersByCluster: jest.fn(),
      retrieveEntitiesByBroker: jest.fn(),
      retrieveAttributes: jest.fn(),
    };

    controller = new AppController(mockAppService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should retrieve data observability stats', async () => {
    const payload: StatsPayloadDTO = {
      from: new Date(),
      to: new Date(),
      entityId: '',
      clusterId: 'enakronic',
      brokerId: 'cluster3e-uc3',
    };
    const mockStatsResponse: StatsResponse = {
      latencyDistributionReport: [{ bin: '1', binEdges: [1, 2], latency: 1 }],
    };
    jest
      .spyOn(mockAppService, 'retrieveStats')
      .mockResolvedValue(mockStatsResponse);
    const res = await controller.retrieveStats(payload);
    expect(res).toStrictEqual(mockStatsResponse);
  });

  it('should retrieve clusters', async () => {
    const mockClusters = [
      {
        title:
          'CLUSTER 3A: AGRITECH TRANSFORMATION AND SUSTAINABILITY INITIATIVE',
        value: 'agroapps',
      },
    ];
    jest
      .spyOn(mockAppService, 'retrieveClusters')
      .mockResolvedValue(mockClusters);
    const res = await controller.retrieveClusters();
    expect(res).toStrictEqual(mockClusters);
  });

  it('should retrieve brokers', async () => {
    const mockBrokers = [
      { title: 'uc2', value: 'cluster3e-uc2' },
      { title: 'uc3', value: 'cluster3e-uc3' },
    ];
    jest
      .spyOn(mockAppService, 'retrieveBrokersByCluster')
      .mockResolvedValue(mockBrokers);
    const res = await controller.retrieveBrokersByCluster('enakronic');
    expect(mockAppService.retrieveBrokersByCluster).toHaveBeenCalledWith(
      'enakronic',
    );
    expect(res).toStrictEqual(mockBrokers);
  });

  it('should retrieve entities', async () => {
    jest
      .spyOn(mockAppService, 'retrieveEntitiesByBroker')
      .mockResolvedValue([]);
    const res = await controller.retrieveEntitiesByBroker('cluster3e-uc3');
    expect(mockAppService.retrieveEntitiesByBroker).toHaveBeenCalledWith(
      'cluster3e-uc3',
    );
    expect(res).toStrictEqual([]);
  });
});
