import { AppService } from './app.service';
import { CreateContextHistory, StatsPayloadDTO } from './dto';

describe('AppService', () => {
  let service: AppService;
  let mockRepository: any;
  let mockHttpService: any;
  let mockAppConfig: any;

  beforeEach(() => {
    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    mockHttpService = {
      axiosRef: {
        post: jest.fn(),
      },
    };

    mockAppConfig = {
      dataAnalyticsUrl: 'http://localhost:8000',
    };

    service = new AppService(mockRepository, mockHttpService, mockAppConfig);
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

  it('should retrieve entities', async () => {
    jest.spyOn(mockRepository, 'getRawMany').mockResolvedValue([{ id: '1' }]);
    const res = await service.retrieveEntities();
    expect(res).toStrictEqual(['1']);
  });

  describe('addContextHistory', () => {
    describe('when data is provided', () => {
      it('should add context history', async () => {
        const data: CreateContextHistory = {
          observedAt: new Date(),
          time: new Date(),
          entityId: 'urn:ngsi-ld:Device:filling001',
          entityType: 'FillingLevelSensor',
          attrName: 'temperature',
          attrType: 'Property',
          value: 22.5,
          metadata: {},
        };
        jest.spyOn(mockRepository, 'create').mockReturnValue(data);
        jest.spyOn(mockRepository, 'save').mockResolvedValue(data);
        const res = await service.addContextHistory(data);
        expect(res).toStrictEqual(data);
        expect(mockRepository.create).toHaveBeenCalledWith(data);
        expect(mockRepository.save).toHaveBeenCalledWith(data);
      });
    });
  });
});
