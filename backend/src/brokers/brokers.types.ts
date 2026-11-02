export type NgsiFlavour = 'ld' | 'v2';

export type ClusterId = '2' | '3A' | '3E' | '4';

export interface SelectOption {
  title: string; // display text
  value: string; // org for clusters, broker id for brokers
}

// discriminated union so the compiler forces the subscribe check
// before anything reads fields/observedAtSource
export type EntityTypeConfig =
  | { subscribe: false }
  | {
      subscribe: true;
      observedAtSource: string | null; // attr carrying the observation timestamp; null = source has none we trust, use receivedAt
      fields: readonly string[]; // approved fields — each becomes one row
    };

// one entity object exactly as it arrived in a notification, before parsing.
// `id` and `type` are the only keys guaranteed across flavours; every other
// key is an attribute whose shape depends on `ngsi`.
export type RawEntity = Record<string, unknown>;

export interface BrokerConfig {
  id: string;
  clusterId: ClusterId;
  org: string;
  ngsi: NgsiFlavour;
  intercept: string; // Ziti host:port, never a raw IP
  basePath: string; // '/v2' | '/ngsi-ld/v1'
  headers?: Record<string, string>; // v2 only: Fiware-Service, Fiware-ServicePath
  ldContext?: string; // LD only
  nonStandardBehaviour?: string; // free text, e.g. cluster4 envelope wrapping
  sourceTimeZone?: string; // IANA zone for observedAtSource values sent without Z/offset; values with one ignore it
  entityTypes: Record<string, EntityTypeConfig>;
}
