import { QueryFailedError } from 'typeorm';
import { AppController } from './app.controller';
import {
  StatsPayloadDTO,
  StatsResponse,
  SubscriptionPayload,
  SubscriptionPayloadDTO,
} from './dto';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: any;

  beforeEach(() => {
    mockAppService = {
      retrieveStats: jest.fn(),
      retrieveEntities: jest.fn(),
      retrieveAttributes: jest.fn(),
      addContextHistory: jest.fn(),
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

  it('should retrieve entities', async () => {
    jest.spyOn(mockAppService, 'retrieveEntities').mockResolvedValue([]);
    const res = await controller.retrieveEntities();
    expect(res).toStrictEqual([]);
  });

  describe('createContextHistory', () => {
    const notifiedAt = new Date('2024-01-01T12:00:00Z');
    const observedAt = new Date('2024-01-01T11:00:00Z');

    const buildPayload = (dataOverride = {}): SubscriptionPayload =>
      ({
        id: 'urn:ngsi-ld:Device:filling001',
        type: 'FillingLevelSensor',
        subscriptionId: 'urn:ngsi-ld:Subscription:5fd0ee554eb81930c97005c1',
        notifiedAt,
        data: [
          {
            id: 'urn:ngsi-ld:Device:filling001',
            type: 'FillingLevelSensor',
            temperature: {
              type: 'Property',
              value: 22.5,
              observedAt,
            },
            ...dataOverride,
          },
        ],
      }) as unknown as SubscriptionPayload;

    describe('when subcription payload array is provided', () => {
      it('should call addContextHistory for each attribute with observedAt', async () => {
        const payload = buildPayload();
        await controller.createContextHistory(payload);

        expect(mockAppService.addContextHistory).toHaveBeenCalledTimes(1);
        expect(mockAppService.addContextHistory).toHaveBeenCalledWith({
          observedAt,
          time: notifiedAt,
          entityId: 'urn:ngsi-ld:Device:filling001',
          entityType: 'FillingLevelSensor',
          attrName: 'temperature',
          attrType: 'Property',
          value: 22.5,
          metadata: {},
        });
      });

      it('should skip attributes without observedAt', async () => {
        const payload = buildPayload({
          humidity: { type: 'Property', value: 60 },
        });
        await controller.createContextHistory(payload);

        expect(mockAppService.addContextHistory).toHaveBeenCalledTimes(1);
        expect(mockAppService.addContextHistory).not.toHaveBeenCalledWith(
          expect.objectContaining({ attrName: 'humidity' }),
        );
      });

      it('should skip id and type keys', async () => {
        const payload = buildPayload();
        await controller.createContextHistory(payload);

        expect(mockAppService.addContextHistory).not.toHaveBeenCalledWith(
          expect.objectContaining({ attrName: 'id' }),
        );
        expect(mockAppService.addContextHistory).not.toHaveBeenCalledWith(
          expect.objectContaining({ attrName: 'type' }),
        );
      });

      it('should preserve extra attribute fields as metadata', async () => {
        const payload = buildPayload({
          temperature: {
            type: 'Property',
            value: 22.5,
            observedAt,
            unitCode: 'CEL',
            datasetId: 'ds-1',
          },
        });
        await controller.createContextHistory(payload);

        expect(mockAppService.addContextHistory).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: { unitCode: 'CEL', datasetId: 'ds-1' },
          }),
        );
      });

      it('should handle multiple attributes across multiple data items', async () => {
        const payload: SubscriptionPayload = {
          id: 'sub-1',
          type: 'Subscription',
          subscriptionId: 'sub-id-1',
          notifiedAt,
          data: [
            {
              id: 'entity-1',
              type: 'SensorDevice',
              temperature: { type: 'Property', value: 22.5, observedAt },
              humidity: { type: 'Property', value: 60, observedAt },
            },
            {
              id: 'entity-2',
              type: 'SensorDevice',
              pressure: { type: 'Property', value: 1013, observedAt },
            },
          ],
        } as unknown as SubscriptionPayload;

        await controller.createContextHistory(payload);

        expect(mockAppService.addContextHistory).toHaveBeenCalledTimes(3);
      });
    });

    describe('when an exception is thrown', () => {
      it('should log and continue on QueryFailedError', async () => {
        const error = new QueryFailedError(
          'insert into context_history duplicate',
          [],
          new Error('duplicate'),
        );
        mockAppService.addContextHistory.mockRejectedValue(error);

        await expect(
          controller.createContextHistory(buildPayload()),
        ).resolves.not.toThrow();
      });

      it('should log and continue on unknown errors', async () => {
        mockAppService.addContextHistory.mockRejectedValue(
          new Error('unexpected'),
        );

        await expect(
          controller.createContextHistory(buildPayload()),
        ).resolves.not.toThrow();
      });
    });

    describe('when subscription payload array is empty', () => {
      it('should do nothing', async () => {
        const payload: SubscriptionPayloadDTO = {
          id: 'sub-1',
          type: 'Subscription',
          subscriptionId: 'sub-id-1',
          notifiedAt,
          data: [],
        } as unknown as SubscriptionPayloadDTO;

        await controller.createContextHistory(payload);

        expect(mockAppService.addContextHistory).not.toHaveBeenCalled();
      });
    });
  });
});
