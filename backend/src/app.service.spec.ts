import { AppService } from './app.service';
import { StatsPayloadDTO } from './dto';

describe('AppService', () => {
  let service: AppService;
  let mockRepository: any;
  let mockBrokerRepository: any;
  let mockHttpService: any;
  let mockAppConfig: any;

  const createMockRepository = () => ({
    createQueryBuilder: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  });

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockBrokerRepository = createMockRepository();

    mockHttpService = {
      axiosRef: {
        post: jest.fn(),
      },
    };

    mockAppConfig = {
      dataAnalyticsUrl: 'http://localhost:8000',
    };

    service = new AppService(
      mockRepository,
      mockBrokerRepository,
      mockHttpService,
      mockAppConfig,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should retrieve data observability stats', async () => {
    const payload: StatsPayloadDTO = {
      from: new Date(),
      to: new Date(),
      entityId: '',
      clusterId: 'enakronic',
      brokerId: 'cluster3e-uc3',
    };
    const mockPost = jest
      .spyOn(mockHttpService.axiosRef, 'post')
      .mockImplementation(() => {
        return Promise.resolve({ data: {} });
      });
    const res = await service.retrieveStats(payload);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(res).toStrictEqual({});
  });

  it('should retrieve clusters', async () => {
    jest.spyOn(mockBrokerRepository, 'getRawMany').mockResolvedValue([
      { org: 'agroapps', clusterId: '3A' },
      { org: 'unknown-org', clusterId: '9' },
    ]);
    const res = await service.retrieveClusters();
    expect(mockBrokerRepository.distinct).toHaveBeenCalledWith(true);
    expect(res).toStrictEqual([
      {
        title:
          'CLUSTER 3A: AGRITECH TRANSFORMATION AND SUSTAINABILITY INITIATIVE',
        value: 'agroapps',
      },
      { title: 'unknown-org', value: 'unknown-org' },
    ]);
  });

  it('should retrieve brokers by cluster', async () => {
    jest.spyOn(mockBrokerRepository, 'getRawMany').mockResolvedValue([
      { id: 'cluster3e-uc2', clusterId: '3E' },
      { id: 'cluster3e-uc3', clusterId: '3E' },
    ]);
    const res = await service.retrieveBrokersByCluster('enakronic');
    expect(mockBrokerRepository.where).toHaveBeenCalledWith(
      'broker.org = :org',
      { org: 'enakronic' },
    );
    expect(res).toStrictEqual([
      { title: 'uc2', value: 'cluster3e-uc2' },
      { title: 'uc3', value: 'cluster3e-uc3' },
    ]);
  });

  it('should retrieve entities by broker', async () => {
    jest.spyOn(mockRepository, 'getRawMany').mockResolvedValue([{ id: '1' }]);
    const res = await service.retrieveEntitiesByBroker('cluster3e-uc3');
    expect(mockRepository.where).toHaveBeenCalledWith(
      'contextHistory.brokerId = :brokerId',
      { brokerId: 'cluster3e-uc3' },
    );
    expect(res).toStrictEqual(['1']);
  });
});
