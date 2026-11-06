import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APP_CONFIG_KEY, AppConfigDTO, InjectConfig } from '../common';
import { Broker } from '../entities';
import { BROKERS } from './brokers.const';
import { BrokerConfig } from './brokers.types';
import {
  buildSubscriptionBody,
  isOurs,
  readSubscriptionFields,
} from './subscription.builder';

// carries the @context url through axios's config-merge to the request
// interceptor (see constructor) — not a header, so the `link` collision
// (constructor comment) doesn't apply to it.
declare module 'axios' {
  interface AxiosRequestConfig {
    ldContext?: string;
  }
}

// remote subscription shape is untyped (broker-controlled JSON).
type RemoteSubscription = Record<string, any>;

// top-level `status` only — never `notification.status`, which reads
// `failed` throughout the Ziti warm-up and would make reconcile restart the
// warm-up forever.
function isInactive(subscription: RemoteSubscription): boolean {
  return (
    subscription.status === 'inactive' || subscription.status === 'expired'
  );
}

function sameAttrs(existing: unknown, desired: readonly string[]): boolean {
  return (
    Array.isArray(existing) &&
    existing.length === desired.length &&
    desired.every((attr) => existing.includes(attr))
  );
}

// drift on notify URI, entity type, or the pinned attribute list.
function hasDrifted(
  broker: BrokerConfig,
  existing: RemoteSubscription,
  desired: ReturnType<typeof buildSubscriptionBody>,
): boolean {
  const have = readSubscriptionFields(broker, existing);
  const want = readSubscriptionFields(broker, desired);
  return (
    have.url !== want.url ||
    have.type !== want.type ||
    !sameAttrs(have.attrs, want.attrs as readonly string[])
  );
}

@Injectable()
export class BrokerSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BrokerSyncService.name);

  constructor(
    @InjectRepository(Broker)
    private readonly repository: Repository<Broker>,
    private readonly httpService: HttpService,
    @InjectConfig(APP_CONFIG_KEY) private readonly appConfig: AppConfigDTO,
  ) {
    // axios bug, not a design choice: a header literally named `Link` (any
    // case) collides with axios's own per-HTTP-method default-header group
    // keys (`link`/`unlink`/`purge`/`query` are real, if obscure, HTTP
    // methods axios tracks), and its config-merge step silently deletes it
    // as if it were that group. Passing it in `request()`'s `headers` object
    // hits that merge; setting it here, in a request interceptor, runs
    // *after* axios has already turned `config.headers` into a proper
    // AxiosHeaders instance, so `.set()` isn't affected.
    this.httpService.axiosRef.interceptors.request.use((config) => {
      if (config.ldContext) {
        config.headers.set(
          'Link',
          `<${config.ldContext}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`,
        );
      }
      return config;
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.syncBrokerRows();
    if (!this.appConfig.brokerSyncEnabled) {
      this.logger.log('BROKER_SYNC_ENABLED is off — skipping reconcile.');
      return;
    }
    await this.reconcileAll();
  }

  // seed rows, never deleted. Upsert
  // keeps the table in step with BROKERS on every boot, no migration needed
  // for a registry-only edit.
  async syncBrokerRows(): Promise<void> {
    const rows = Object.values(BROKERS).map((broker) => ({
      id: broker.id,
      clusterId: broker.clusterId,
      org: broker.org,
      ngsi: broker.ngsi,
    }));
    await this.repository.upsert(rows, ['id']);
    this.logger.log(`Synced ${rows.length} broker rows.`);
  }

  /**
   * For every broker with at least one `subscribe: true` entity type,
   * reconcile it against the live broker.
   */
  async reconcileAll(): Promise<void> {
    // `satisfies` leaves BROKERS a literal union with no index signature.
    const brokers = Object.values(BROKERS).filter((broker: BrokerConfig) =>
      Object.values(broker.entityTypes).some((config) => config.subscribe),
    );

    for (const broker of brokers) {
      try {
        await this.reconcile(broker);
      } catch (error) {
        this.logger.error(
          `[${broker.id}] reconcile failed: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
  }

  /**
   * Per broker: GET existing subscriptions, create missing, delete +
   * recreate on drift, treat
   * existing-but-inactive as missing, never touch a subscription that isn't
   * ours, delete a marked subscription whose type de-scoped to
   * `subscribe: false`, then report
   * status/timesSent/lastSuccess/lastFailure without acting on it.
   */
  async reconcile(broker: BrokerConfig): Promise<void> {
    const notifyUrl = this.notifyUrl(broker);
    const subscriptions = await this.request<RemoteSubscription[]>(
      broker,
      'GET',
      '/subscriptions',
    );
    const tag = this.appConfig.subscriptionTag;
    const ours = subscriptions.filter((sub) => isOurs(broker, sub, tag));

    for (const [entityType, config] of Object.entries(broker.entityTypes)) {
      const existing = ours.find(
        (sub) => readSubscriptionFields(broker, sub).type === entityType,
      );

      if (!config.subscribe) {
        // a type de-scoped from `subscribe: true` must stop delivering, not
        // linger forever.
        if (existing) {
          await this.request(broker, 'DELETE', `/subscriptions/${existing.id}`);
          this.logger.log(
            `[${broker.id}] deleted subscription for de-scoped type ${entityType}`,
          );
        }
        continue;
      }

      if (existing) this.logHealth(broker, entityType, existing);

      const desired = buildSubscriptionBody(broker, entityType, notifyUrl, tag);

      if (!existing) {
        await this.request(broker, 'POST', '/subscriptions', desired);
        this.logger.log(
          `[${broker.id}] created subscription for ${entityType}`,
        );
        continue;
      }

      if (isInactive(existing) || hasDrifted(broker, existing, desired)) {
        await this.request(broker, 'DELETE', `/subscriptions/${existing.id}`);
        await this.request(broker, 'POST', '/subscriptions', desired);
        this.logger.log(
          `[${broker.id}] recreated subscription for ${entityType}`,
        );
      }
    }
  }

  private logHealth(
    broker: BrokerConfig,
    entityType: string,
    subscription: RemoteSubscription,
  ): void {
    this.logger.log(
      `[${broker.id}] ${entityType}: status=${subscription.status} ` +
        `timesSent=${subscription.notification?.timesSent} ` +
        `lastSuccess=${subscription.notification?.lastSuccess} ` +
        `lastFailure=${subscription.notification?.lastFailure}`,
    );
  }

  // derived, never stored — host/port
  // from config, path from the registry key, so an env move needs no migration.
  notifyUrl(broker: BrokerConfig): string {
    const base = this.appConfig.notifyBaseUrl.replace(/\/$/, '');
    return `${base}/subscriptions/${broker.id}`;
  }

  private async request<T>(
    broker: BrokerConfig,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `http://${broker.intercept}${broker.basePath}${path}`;
    // Link header, not an inline
    // `@context` in the body: axios sends Content-Type: application/json, and
    // Orion-LD requires the Link form with that content type (inline @context
    // needs application/ld+json, and the two must not be combined). Sent via
    // `ldContext` here, not `headers.Link` — see the constructor's
    // interceptor for why.
    const response = await this.httpService.axiosRef.request<T>({
      method,
      url,
      data: body,
      headers: broker.headers,
      ldContext: broker.ldContext,
      timeout: 10000,
    });
    return response.data;
  }
}
