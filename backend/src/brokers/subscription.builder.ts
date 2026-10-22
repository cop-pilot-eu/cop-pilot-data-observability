import { BrokerConfig, EntityTypeConfig } from './brokers.types';

// NGSI-LD subscription body shape.
// `entities` targets every entity of the type; the trigger side
// (`watchedAttributes`) is left unset on purpose — pinned
// attributes only ever filter the payload, never the trigger.
interface NgsiLdSubscriptionBody {
  id: string;
  type: 'Subscription';
  entities: [{ type: string }];
  notification: {
    attributes: readonly string[];
    endpoint: { uri: string; accept: 'application/json' };
  };
}

// NGSIv2 subscription body shape.
// Same pinning rule as LD, on `notification.attrs`; `description` carries the
// ownership marker since v2 assigns the subscription id itself.
interface NgsiV2SubscriptionBody {
  description: string;
  subject: {
    entities: [{ idPattern: string; type: string }];
  };
  notification: {
    http: { url: string };
    attrs: readonly string[];
  };
}

/**
 * Reads notify URL, entity type, and pinned attrs off any object shaped like
 * {@link NgsiLdSubscriptionBody} or {@link NgsiV2SubscriptionBody} — our own
 * desired body or the broker's raw subscription response, both shaped alike
 * per flavour. Single place the LD/v2 field-path split lives, so a shape
 * change touches only this function instead of every caller re-branching.
 */
export function readSubscriptionFields(
  broker: BrokerConfig,
  subscription: Record<string, any>,
): { url?: string; type?: string; attrs?: unknown } {
  return broker.ngsi === 'ld'
    ? {
        url: subscription.notification?.endpoint?.uri,
        type: subscription.entities?.[0]?.type,
        attrs: subscription.notification?.attributes,
      }
    : {
        url: subscription.notification?.http?.url,
        type: subscription.subject?.entities?.[0]?.type,
        attrs: subscription.notification?.attrs,
      };
}

/**
 * Pinned attributes are
 * `[...fields, observedAtSource]` (or just `fields`, when the source has no
 * trustworthy timestamp and `observedAtSource` is `null`) on `notification.attrs` (v2) /
 * `notification.attributes` (LD) — the payload filter, and the only
 * enforcement point for the field allowlist. The trigger side
 * (`subject.condition.attrs` / `watchedAttributes`) is left unset so any
 * change fires. `maxFailsLimit` is deliberately never set —
 * reconcile keys on `status` only, never on `lastFailure`/`failsCounter`.
 * `id` (LD) / `description` (v2) is `subscriptionMarker(broker, entityType)`.
 */
// broker.ldContext is not sent here — the @context travels on the `Link`
// header, added in broker-sync.service.ts's request(), not in the body.
export function buildSubscriptionBody(
  broker: BrokerConfig,
  entityType: string,
  notifyUrl: string,
): NgsiLdSubscriptionBody | NgsiV2SubscriptionBody {
  const config = broker.entityTypes[entityType] as Extract<
    EntityTypeConfig,
    { subscribe: true }
  >;
  // `observedAtSource` may be a dotted path into a sub-property (e.g.
  // `soilMoisture.timestamp`) — only the root segment is a real attribute
  // name the broker knows; pinning the dotted string itself would ask the
  // broker to filter on an attribute that doesn't exist.
  const attrs = [
    ...new Set(
      config.observedAtSource
        ? [...config.fields, config.observedAtSource.split('.')[0]]
        : config.fields,
    ),
  ];
  const marker = subscriptionMarker(broker, entityType);

  if (broker.ngsi === 'ld') {
    return {
      id: marker,
      type: 'Subscription',
      entities: [{ type: entityType }],
      notification: {
        attributes: attrs,
        endpoint: { uri: notifyUrl, accept: 'application/json' },
      },
    };
  }

  return {
    description: marker,
    subject: { entities: [{ idPattern: '.*', type: entityType }] },
    notification: { http: { url: notifyUrl }, attrs },
  };
}

/**
 * Ownership marker. LD: deterministic id
 * `urn:ngsi-ld:Subscription:suite5:<brokerId>:<EntityType>`. v2: `description`
 * field `suite5-cop-pilot:<brokerId>:<EntityType>` — v2 subscriptions have no
 * deterministic id, the broker assigns it, so `description` is the marker.
 */
export function subscriptionMarker(
  broker: BrokerConfig,
  entityType: string,
): string {
  return broker.ngsi === 'ld'
    ? `urn:ngsi-ld:Subscription:suite5:${broker.id}:${entityType}`
    : `suite5-cop-pilot:${broker.id}:${entityType}`;
}

/**
 * True iff `subscription`'s id (LD) or `description` (v2) matches
 * `subscriptionMarker` for some entity type on `broker`. Never touch a
 * subscription that fails this check — not ours to
 * delete, recreate, or otherwise act on.
 *
 * Prefix match, not exact match against the current registry's type set
 * also recognises an orphan
 * left by an earlier deploy whose type has since been removed from the
 * registry, so it doesn't keep delivering unnoticed forever.
 */
export function isOurs(broker: BrokerConfig, subscription: unknown): boolean {
  if (typeof subscription !== 'object' || subscription === null) return false;
  const { id, description } = subscription as {
    id?: unknown;
    description?: unknown;
  };

  if (broker.ngsi === 'ld') {
    return (
      typeof id === 'string' &&
      id.startsWith(`urn:ngsi-ld:Subscription:suite5:${broker.id}:`)
    );
  }
  return (
    typeof description === 'string' &&
    description.startsWith(`suite5-cop-pilot:${broker.id}:`)
  );
}
