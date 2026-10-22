import { BrokerConfig } from './brokers.types';
import { getBroker } from './brokers.const';
import {
  buildSubscriptionBody,
  isOurs,
  subscriptionMarker,
} from './subscription.builder';

const v2Broker = getBroker('cluster3e-uc3')!;
const notifyUrlV2 = 'http://localhost:5000/subscriptions/cluster3e-uc3';

const cluster2 = getBroker('cluster2')!;
const notifyUrlCluster2 = 'http://localhost:5000/subscriptions/cluster2';
const floodType = 'FloodMonitoring';

const ldBroker: BrokerConfig = {
  id: 'test-ld',
  clusterId: '3A',
  org: 'test',
  ngsi: 'ld',
  intercept: 'test.ziti:1026',
  basePath: '/ngsi-ld/v1',
  entityTypes: {
    Widget: {
      subscribe: true,
      observedAtSource: 'TimeInstant',
      fields: ['temperature'],
    },
  },
};
const notifyUrlLd = 'http://localhost:5000/subscriptions/test-ld';

describe('buildSubscriptionBody', () => {
  it('builds the v2 shape with observedAtSource pinned alongside fields', () => {
    const body = buildSubscriptionBody(v2Broker, 'Digester', notifyUrlV2);
    expect(body).toMatchObject({
      description: subscriptionMarker(v2Broker, 'Digester'),
      subject: { entities: [{ idPattern: '.*', type: 'Digester' }] },
      notification: { http: { url: notifyUrlV2 } },
    });
    expect((body as any).notification.attrs.sort()).toStrictEqual(
      [
        'CH4concentration',
        'CO2concentration',
        'H2Sconcentration',
        'TimeInstant',
        'pH',
      ].sort(),
    );
  });

  it('builds the LD shape with observedAtSource pinned alongside fields', () => {
    const body = buildSubscriptionBody(ldBroker, 'Widget', notifyUrlLd);
    expect(body).toMatchObject({
      id: subscriptionMarker(ldBroker, 'Widget'),
      type: 'Subscription',
      entities: [{ type: 'Widget' }],
      notification: {
        endpoint: { uri: notifyUrlLd, accept: 'application/json' },
      },
    });
    expect((body as any).notification.attributes.sort()).toStrictEqual(
      ['TimeInstant', 'temperature'].sort(),
    );
  });

  it('pins only the root segment of a dotted observedAtSource (cluster4 soilMoisture.metadata.timestamp)', () => {
    // cluster4's restore config (brokers.const.ts) — inline because the live
    // registry has every cluster4 type paused at subscribe:false.
    const cluster4: BrokerConfig = {
      ...getBroker('cluster4')!,
      entityTypes: {
        SoilMoistureSensorAggregator: {
          subscribe: true,
          observedAtSource: 'soilMoisture.metadata.timestamp',
          fields: ['soilMoisture'],
        },
      },
    };
    const notifyUrlCluster4 = 'http://localhost:5000/subscriptions/cluster4';
    const body = buildSubscriptionBody(
      cluster4,
      'SoilMoistureSensorAggregator',
      notifyUrlCluster4,
    );
    // `timestamp` is metadata of `soilMoisture`, not an attribute of its
    // own, so only `soilMoisture` may be pinned.
    expect(body).toMatchObject({
      description: 'suite5-cop-pilot:cluster4:SoilMoistureSensorAggregator',
      subject: {
        entities: [{ idPattern: '.*', type: 'SoilMoistureSensorAggregator' }],
      },
      notification: { http: { url: notifyUrlCluster4 } },
    });
    expect((body as any).notification.attrs).toStrictEqual(['soilMoisture']);
  });

  it("builds the LD body for cluster2's SDM-mapped FloodMonitoring, short names throughout", () => {
    const body = buildSubscriptionBody(cluster2, floodType, notifyUrlCluster2);
    expect(body).toMatchObject({
      id: 'urn:ngsi-ld:Subscription:suite5:cluster2:FloodMonitoring',
      type: 'Subscription',
      entities: [{ type: floodType }],
      notification: {
        endpoint: { uri: notifyUrlCluster2, accept: 'application/json' },
      },
    });
    // no `observationDateTime` — cluster2's `observedAtSource` is null,
    // so only the value fields are pinned.
    expect((body as any).notification.attributes.sort()).toStrictEqual(
      ['currentLevel', 'measuredDistance'].sort(),
    );
    expect(isOurs(cluster2, { id: (body as any).id })).toBe(true);
  });
});

describe('isOurs', () => {
  it('accepts our v2 marker and rejects a foreign subscription', () => {
    expect(
      isOurs(v2Broker, {
        description: subscriptionMarker(v2Broker, 'Digester'),
      }),
    ).toBe(true);
    expect(
      isOurs(v2Broker, { description: 'someone-elses-subscription' }),
    ).toBe(false);
  });

  it('accepts our LD marker and rejects a foreign subscription', () => {
    expect(
      isOurs(ldBroker, { id: subscriptionMarker(ldBroker, 'Widget') }),
    ).toBe(true);
    expect(
      isOurs(ldBroker, {
        id: 'urn:ngsi-ld:Subscription:someone-else:test-ld:Widget',
      }),
    ).toBe(false);
  });
});
