import { BadRequestException } from '@nestjs/common';
import { getBroker } from './brokers.const';
import { BrokerConfig } from './brokers.types';
import { parseNotification } from './notification.parser';

const broker = getBroker('cluster3e-uc3')!;
const receivedAt = new Date('2026-09-08T10:00:00.000Z');

const digesterEntity = {
  id: 'urn:ngsi-ld:Digester:SERVER1:D1',
  type: 'Digester',
  pH: {
    type: 'Number',
    value: 9,
    metadata: {
      TimeInstant: { type: 'DateTime', value: '2026-09-08T09:59:00.000Z' },
    },
  },
  CH4concentration: {
    type: 'Number',
    value: 55,
    metadata: {
      TimeInstant: { type: 'DateTime', value: '2026-09-08T09:59:00.000Z' },
    },
  },
  CO2concentration: {
    type: 'Number',
    value: 44,
    metadata: {
      TimeInstant: { type: 'DateTime', value: '2026-09-08T09:59:00.000Z' },
    },
  },
  H2Sconcentration: {
    type: 'Number',
    value: 2550,
    metadata: {
      TimeInstant: { type: 'DateTime', value: '2026-09-08T09:59:00.000Z' },
    },
  },
  digesterType: { type: 'Text', value: 'hydrolysis' },
  stageOrder: { type: 'Number', value: 1 },
  isPartOfPlant: {
    type: 'Relationship',
    value: 'urn:ngsi-ld:BiogasPlant:SERVER1',
  },
  feedsInto: { type: 'Relationship', value: 'urn:ngsi-ld:Digester:SERVER1:D2' },
  TimeInstant: { type: 'DateTime', value: '2026-09-08T09:59:00.000Z' },
};

describe('parseNotification', () => {
  it('emits one row per approved field, drops unapproved and TimeInstant', () => {
    const rows = parseNotification(
      broker,
      { subscriptionId: 'sub-1', data: [digesterEntity] },
      receivedAt,
    );

    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.attrName).sort()).toStrictEqual([
      'CH4concentration',
      'CO2concentration',
      'H2Sconcentration',
      'pH',
    ]);
    expect(rows.every((r) => r.time === receivedAt)).toBe(true);
    expect(
      rows.every(
        (r) => r.observedAt.toISOString() === '2026-09-08T09:59:00.000Z',
      ),
    ).toBe(true);
  });

  it('skips entities of an unmapped type without throwing', () => {
    const rows = parseNotification(
      broker,
      { subscriptionId: 'sub-1', data: [{ id: 'x', type: 'AccessCount' }] },
      receivedAt,
    );
    expect(rows).toStrictEqual([]);
  });

  it('skips entities of a subscribe:false type', () => {
    const rows = parseNotification(
      broker,
      {
        subscriptionId: 'sub-1',
        data: [{ id: 'urn:ngsi-ld:BiogasPlant:SERVER1', type: 'BiogasPlant' }],
      },
      receivedAt,
    );
    expect(rows).toStrictEqual([]);
  });

  it('rejects a malformed envelope with 400', () => {
    expect(() => parseNotification(broker, {}, receivedAt)).toThrow(
      BadRequestException,
    );
  });
});

describe('parseNotification — cluster2 (NGSI-LD, SDM context)', () => {
  const cluster2 = getBroker('cluster2')!;
  const floodType = 'FloodMonitoring';
  const aqoType = 'AirQualityObserved';

  it('emits rows keyed by short attrName/entityType for an SDM-mapped type', () => {
    const floodEntity = {
      id: 'urn:ngsi-ld:FloodMonitoring:WIOTRAD_CanalCrespo',
      type: floodType,
      currentLevel: { type: 'Property', value: 0 },
      // present on the wire but unreliable at source: 1 of 3
      // entities stale by ~3 months, so the registry pins
      // `observedAtSource: null` and this value is ignored.
      observationDateTime: { type: 'Property', value: '2026-09-09T08:00:20' },
    };
    const rows = parseNotification(
      cluster2,
      { data: [floodEntity] },
      receivedAt,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].attrName).toBe('currentLevel');
    expect(rows[0].entityType).toBe(floodType);
    expect(rows[0].observedAt.toISOString()).toBe(receivedAt.toISOString());
  });

  it('ignores `t` on a DevEUI AirQualityObserved entity — frozen at source', () => {
    const deveuiEntity = {
      id: 'urn:ngsi-ld:AirQualityObserved:36-32-37-32-55-32-78-0f',
      type: aqoType,
      hcho: { type: 'Property', value: 0 },
      // `t` frozen across every entity — registry pins
      // `observedAtSource: null`, so receivedAt wins.
      t: { type: 'Property', value: '2026-07-07T21:19:28.000Z' },
    };
    const rows = parseNotification(
      cluster2,
      { data: [deveuiEntity] },
      receivedAt,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].observedAt.toISOString()).toBe(receivedAt.toISOString());
  });

  it('falls back to receivedAt when observedAtSource is null (Access — TimeInstant frozen at source)', () => {
    const accessEntity = {
      id: 'urn:ngsi-ld:Access:24-e1-24-76-7f-02-42-38',
      type: 'Access',
      TimeInstant: { type: 'Property', value: '2026-02-17T06:00:00.000Z' },
      totalCounterIn: { type: 'Property', value: 7 },
    };
    const rows = parseNotification(
      cluster2,
      { data: [accessEntity] },
      receivedAt,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].observedAt).toBe(receivedAt);
  });

  it('skips an address-population AirQualityObserved entity with no `t`, not crash', () => {
    const addressEntity = {
      id: 'urn:ngsi-ld:AirQualityObserved:Francia',
      type: aqoType,
      ch2o: { type: 'Property', value: 0 },
    };
    const rows = parseNotification(
      cluster2,
      { data: [addressEntity] },
      receivedAt,
    );
    expect(rows).toStrictEqual([]);
  });
});

describe('parseNotification — cluster4 (OneSource)', () => {
  // cluster4's restore config (brokers.const.ts) — inline because the live
  // registry has every cluster4 type paused at subscribe:false.
  const cluster4: BrokerConfig = {
    ...getBroker('cluster4')!,
    entityTypes: {
      TemperatureSensorAggregator: {
        subscribe: true,
        observedAtSource: 'temperature.metadata.timestamp',
        fields: ['temperature'],
      },
    },
  };

  // verbatim from a captured v2 notification: the observation time is
  // attribute metadata, not an attribute of its own.
  it('resolves observedAt from a metadata path (temperature.metadata.timestamp)', () => {
    const rows = parseNotification(
      cluster4,
      {
        subscriptionId: '6aa81e96dc9a4bd364d1f42a',
        data: [
          {
            id: 'urn:ngsi-ld:TemperatureSensorAggregator:104',
            type: 'TemperatureSensorAggregator',
            temperature: {
              type: 'Number',
              value: 35.14,
              metadata: {
                lat: { type: 'Number', value: 41.641558 },
                lon: { type: 'Number', value: -3.206919 },
                timestamp: { type: 'Text', value: '2026-09-14T15:57:01Z' },
                unit: { type: 'Text', value: 'Celsius' },
              },
            },
          },
        ],
      },
      receivedAt,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].attrName).toBe('temperature');
    expect(rows[0].observedAt.toISOString()).toBe(
      new Date('2026-09-14T15:57:01Z').toISOString(),
    );
  });

  it('falls back to receivedAt when the metadata timestamp is missing', () => {
    const bareEntity = {
      id: 'urn:ngsi-ld:TemperatureSensorAggregator:104',
      type: 'TemperatureSensorAggregator',
      temperature: { type: 'Number', value: 26.8, metadata: {} },
    };
    const rows = parseNotification(cluster4, { data: [bareEntity] }, receivedAt);
    expect(rows).toHaveLength(1);
    expect(rows[0].observedAt).toBe(receivedAt);
  });
});
