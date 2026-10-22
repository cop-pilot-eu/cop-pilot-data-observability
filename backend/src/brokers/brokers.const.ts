import { BrokerConfig, ClusterId } from './brokers.types';

// Source of truth.
// Every broker gets identity + connection fields so the `brokers` table FK
// resolves for any of them. entityTypes may be empty or `subscribe: false`
// until the field list is confirmed.
export const BROKERS = {
  cluster2: {
    id: 'cluster2',
    clusterId: '2',
    org: 'upv-iteam',
    ngsi: 'ld',
    intercept: 'cluster2-upv-orion-ld.sif:1026',
    basePath: '/ngsi-ld/v1',
    ldContext:
      'https://smart-data-models.github.io/dataModel.Environment/context.jsonld',
    entityTypes: {
      // TimeInstant frozen at source: same stale value across readings, so
      // it's not observed time — use receivedAt.
      WasteContainer: {
        subscribe: true,
        observedAtSource: null,
        fields: ['fillingLevel', 'distance', 'temperature', 'battery'],
      },
      // TimeInstant frozen at source: same value across every entity, so
      // it's not observed time — use receivedAt.
      MobileRadar: {
        subscribe: true,
        observedAtSource: null,
        fields: [
          'avgSpeed',
          'maxSpeed',
          'vehicleUp',
          'vehicleDown',
          'vehicleLight',
          'vehicleMedium',
          'vehicleHeavy',
        ],
      },
      // TimeInstant frozen at source: same stale value across readings, so
      // it's not observed time — use receivedAt.
      Access: {
        subscribe: true,
        observedAtSource: null,
        fields: [
          'totalCounterIn',
          'totalCounterOut',
          'totalCounterDif',
          'line_1_period_in',
          'line_1_period_out',
        ],
      },
      // observationDateTime unreliable at source: 1 of 3 entities stale by
      // ~3 months, rest fresh — use receivedAt.
      FloodMonitoring: {
        subscribe: true,
        observedAtSource: null,
        fields: ['currentLevel', 'measuredDistance'],
      },
      // DevEUI population only. `t` stale at source: frozen at one value
      // across every entity — use receivedAt.
      AirQualityObserved: {
        subscribe: true,
        observedAtSource: null,
        fields: [
          'hcho',
          'avgScaledValue',
          'minScaledValue',
          'maxScaledValue',
          'batteryLevel',
        ],
      },
    },
  },
  'cluster3e-uc2': {
    id: 'cluster3e-uc2',
    clusterId: '3E',
    org: 'enakronic',
    ngsi: 'v2',
    intercept: 'orion-cb-jetson-1.ziti:1026',
    basePath: '/v2',
    headers: { 'Fiware-Service': 'energy', 'Fiware-ServicePath': '/' },
    entityTypes: {
      // Per-phase attrs (activePower, current, phaseVoltage, powerFactor,
      // activeEnergyImport, reactiveEnergyImport, reactivePower) are all
      // StructuredValue {L1,L2,L3} — non-scalar, dropped, and voltage/current/
      // powerFactor have no scalar equivalent. Only the totals + frequency are scalar.
      // dateObserved live at source.
      ACMeasurement: {
        subscribe: true,
        observedAtSource: 'dateObserved',
        fields: ['frequency', 'totalActivePower', 'totalReactivePower'],
      },
      // dateDetected live at source.
      // anomalyScore is -0.1 on both entities while modelReady is false — model
      // untrained, keep subscribed so the flatline is visible. isAnomaly/modelReady
      // are Boolean, skipped: every field in this registry is numeric.
      EVChargerAnomaly: {
        subscribe: true,
        observedAtSource: 'dateDetected',
        fields: ['anomalyScore'],
      },
      // forecastGeneratedAt did not advance over a ~4 min window, but neither did
      // the forecast values — slower regeneration cadence, not a frozen clock
      // (unlike cluster2's TimeInstant).
      EVChargerForecast: {
        subscribe: true,
        observedAtSource: 'forecastGeneratedAt',
        fields: [
          'forecastedPower15m',
          'forecastedPower30m',
          'forecastedPower60m',
        ],
      },
      // not on the broker — /v2/types returns only the three above.
      EnergyMeterMetadata: { subscribe: false },
    },
  },
  'cluster3e-uc3': {
    id: 'cluster3e-uc3',
    clusterId: '3E',
    org: 'enakronic',
    ngsi: 'v2',
    intercept: 'orion-cb-jetson.ziti:1026',
    basePath: '/v2',
    headers: { 'Fiware-Service': 'bpo', 'Fiware-ServicePath': '/v1' },
    entityTypes: {
      Digester: {
        subscribe: true,
        observedAtSource: 'TimeInstant',
        fields: [
          'pH',
          'CH4concentration',
          'CO2concentration',
          'H2Sconcentration',
        ],
      },
      CHPUnit: {
        subscribe: true,
        observedAtSource: 'TimeInstant',
        fields: ['electricalOutput'],
      },
      BiogasPlant: { subscribe: false }, // static, zero numeric attrs
    },
  },
  'cluster3a-aua': {
    id: 'cluster3a-aua',
    clusterId: '3A',
    org: 'agroapps',
    ngsi: 'ld',
    intercept: 'aua-orion-ld.ziti:1026',
    basePath: '/ngsi-ld/v1',
    // required: without these, broker returns the default tenant (empty),
    // not the real data. Legacy Fiware-Service multi-tenancy header on an
    // NGSI-LD endpoint.
    headers: {
      'Fiware-Service': 'husky_service',
      'Fiware-ServicePath': '/robots',
    },
    // unverified: standard ETSI path. Harmless — subscribe:false, no request
    // sent — confirm on integration.
    ldContext: 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld',
    entityTypes: {
      RobotPresence: { subscribe: false }, // robotId/status are strings, location is GeoProperty — zero numeric attrs
      MissionSummary: {
        subscribe: true,
        observedAtSource: 'completionTimestamp',
        fields: ['totalWeedsDetected'],
      },
    },
  },
  'cluster3a-ilink': {
    id: 'cluster3a-ilink',
    clusterId: '3A',
    org: 'agroapps',
    ngsi: 'ld',
    intercept: 'ilink-orion-ld.ziti:1026',
    basePath: '/ngsi-ld/v1',
    // unverified: standard ETSI path. Harmless — subscribe:false, no request
    // sent — confirm on integration.
    ldContext:
      'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld',
    entityTypes: {
      // CO2 entity still unfinalized.
      HarvestReadiness: {
        subscribe: true,
        observedAtSource: 'notified_at',
        fields: ['estimated_yield_tonnes'],
      },
    },
  },
  'cluster3a-weather': {
    id: 'cluster3a-weather',
    clusterId: '3A',
    org: 'agroapps',
    ngsi: 'ld',
    intercept: 'agroapps-orion-ld.ziti:1026',
    basePath: '/ngsi-ld/v1',
    // unverified: standard ETSI path. Harmless — subscribe:false, no request
    // sent — confirm on integration.
    ldContext: 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld',
    entityTypes: {
      WeatherData: { subscribe: false }, // all measurement attrs (temperature2m, precipitation, ...) are arrays — parser drops non-scalar values
      UavData: { subscribe: false }, // parcelId/date/timestamp/fileUrl are metadata, zero numeric measurement attrs
    },
  },
  cluster4: {
    id: 'cluster4',
    clusterId: '4',
    org: 'onesource',
    // v2, not LD: OneSource writes every entity through NGSIv2, so LD
    // subscriptions can never match them.
    // No Fiware-Service headers, no @context.
    ngsi: 'v2',
    intercept: 'fiware.cop-pilot.onesource.ziti:1026',
    basePath: '/v2',
    nonStandardBehaviour:
      'GET /v2/subscriptions crashes the broker while any LD-created subscription is in its store',
    entityTypes: {
      // Paused: sensor node has no power, so it sends no data. Before
      // flipping back, check with OneSource that no LD subscription is left
      // on the broker — reconcile's GET /v2/subscriptions crashes it
      // otherwise. Config to restore (fields from OneSource; v2 timestamp
      // paths from attribute metadata):
      //   SoilMoistureSensorAggregator: observedAtSource 'soilMoisture.metadata.timestamp', fields ['soilMoisture']
      //   TemperatureSensorAggregator:  observedAtSource 'temperature.metadata.timestamp',  fields ['temperature']
      //   DeviceMeasurement: observedAtSource null (dateObserved stale), fields ['numValue']
      //   WeatherObserved:   observedAtSource null, fields ['precipitation']
      SoilMoistureSensorAggregator: { subscribe: false },
      TemperatureSensorAggregator: { subscribe: false },
      DeviceMeasurement: { subscribe: false },
      WeatherObserved: { subscribe: false },
      Device: { subscribe: false }, // static metadata, zero numeric attrs
    },
  },
} as const satisfies Record<string, BrokerConfig>;

export type BrokerId = keyof typeof BROKERS;

export function getBroker(id: string): BrokerConfig | undefined {
  return (BROKERS as Record<string, BrokerConfig>)[id];
}

// Display titles for the frontend's cluster picker.
export const CLUSTER_TITLES: Record<ClusterId, string> = {
  '2': 'CLUSTER 2: SMART BUILDINGS/CITIES',
  '3A': 'CLUSTER 3A: AGRITECH TRANSFORMATION AND SUSTAINABILITY INITIATIVE',
  '3E': 'CLUSTER 3E: SMART & RESILIENT RES-RICH, CROSS-SECTOR COUPLED DISTRIBUTION GRID',
  '4': 'CLUSTER 4: SMART VINEYARDS & SUSTAINABLE WINERY ECOSYSTEMS',
};

// Cluster 3 brokers share a cluster prefix (cluster3a-aua, cluster3e-uc3),
// so the picker shows only the part after it: "aua", "uc3".
export function getBrokerTitle(id: string, clusterId: ClusterId): string {
  if (!clusterId.startsWith('3')) return id;
  return id.split('-')[1] ?? id;
}
