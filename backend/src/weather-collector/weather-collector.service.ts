import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';

const entities = [
  { entityId: 'urn:ngsi-ld:AgriParcelRecord:001', type: 'AgriParcelRecord' },
];

interface OpenWeatherMapResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  base: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    sea_level: number;
    grnd_level: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust: number;
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    type: number;
    id: number;
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

interface WeatherData {
  temperature: number;
  humidity: number;
}

interface Subscription {
  id: string;
  type: 'Subscription';
  entities: EntitySubscription[];
  status: string;
  isActive: boolean;
  notification: Notification;
  jsonldContext: string;
}

interface EntitySubscription {
  type: string;
}

interface Notification {
  format: string;
  endpoint: NotificationEndpoint;
  status: string;
}

interface NotificationEndpoint {
  uri: string;
  accept: string;
}

@Injectable()
export class WeathercollectorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WeathercollectorService.name);

  private readonly orionUrl = 'http://localhost:1026/ngsi-ld/v1';
  private readonly weatherApiKey = '5127003d3484f6c52fcc29c0a7540054';
  private readonly context =
    'https://raw.githubusercontent.com/smart-data-models/dataModel.Agrifood/master/context.jsonld';

  constructor(private readonly httpService: HttpService) {}

  async onApplicationBootstrap() {
    this.logger.log('Initializing Weather collector...');
    //entity
    try {
      await firstValueFrom(
        this.httpService.get(
          `${this.orionUrl}/entities/${entities[0].entityId}`,
        ),
      );
      this.logger.log(`Entity ${entities[0].entityId} already exists.`);
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 404) {
          this.logger.warn(
            `Entity ${entities[0].entityId} not found. Creating new...`,
          );
          await this.createEntity();
        } else {
          this.logger.error('Error checking entity existence:', error.message);
        }
      }
    }
    //subscriptions
    try {
      const subscriptions = await this.getSubscriptions();

      this.logger.log(`Current subscriptions: ${subscriptions.length}`);
      if (subscriptions.length > 0) {
        this.logger.log('Deleting existing subscriptions...');
        for (const subscription of subscriptions) {
          await firstValueFrom(
            this.httpService.delete(
              `${this.orionUrl}/subscriptions/${subscription.id}`,
            ),
          );
        }
      }

      this.logger.log('Creating new subscription...');
      await this.createSubscription();
    } catch (e: unknown) {
      if (e instanceof AxiosError) {
        this.logger.error('Subscription management failed:', e.message);
        this.logger.error(
          'Service will continue but notifications may not work',
        );
      }
    }
  }

  private async getSubscriptions(): Promise<Subscription[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<Subscription[]>(`${this.orionUrl}/subscriptions/`),
      );
      return data;
    } catch (e: unknown) {
      if (e instanceof AxiosError) {
        this.logger.error('Failed to fetch subscriptions: ', e.message);
      }
      throw e;
    }
  }

  private async createSubscription() {
    const payload = {
      type: 'Subscription',
      entities: [{ type: '*' }],
      notification: {
        endpoint: {
          uri: 'http://host.docker.internal:3000/subscription', //backend url
          accept: 'application/json',
        },
      },
      '@context': [this.context],
    };

    try {
      await firstValueFrom(
        this.httpService.post(`${this.orionUrl}/subscriptions`, payload, {
          headers: { 'Content-Type': 'application/ld+json' },
        }),
      );
      this.logger.log('Subscription created successfully.');
    } catch (e: unknown) {
      if (e instanceof AxiosError) {
        this.logger.error('Failed to create subscription:', e.message);
      }
      throw e;
    }
  }

  private async createEntity() {
    const payload = {
      id: entities[0].entityId,
      type: entities[0].type,
      '@context': this.context,
    };

    try {
      await firstValueFrom(
        this.httpService.post(`${this.orionUrl}/entities/`, payload, {
          headers: { 'Content-Type': 'application/ld+json' },
        }),
      );
      this.logger.log('Entity created successfully.');
    } catch (e: unknown) {
      if (e instanceof AxiosError) {
        this.logger.error('Failed to create entity:', e.message);
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    try {
      const weatherData = await this.getWeatherData();

      if (!weatherData) {
        this.logger.warn('No weather data available, skipping update.');
        return;
      }

      this.logger.debug(
        `Fetched Temp: ${weatherData.temperature}°C, Humidity: ${weatherData.humidity}%. Pushing to Orion...`,
      );

      await this.updateOrionEntity(weatherData);
    } catch (error) {
      this.logger.error('Failed to update weather data:', error);
    }
  }

  private async updateOrionEntity(weatherData: WeatherData) {
    const updatePayload = {
      leafTemperature: {
        type: 'Property',
        value: weatherData.temperature,
        observedAt: new Date().toISOString(),
      },
      leafRelativeHumidity: {
        type: 'Property',
        value: weatherData.humidity / 100,
        observedAt: new Date().toISOString(),
      },
      // leafWetness: {
      //   type: 'Property',
      //   value: 1,
      //   observedAt: new Date().toISOString(),
      // },
      '@context': this.context,
    };

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.orionUrl}/entities/${entities[0].entityId}/attrs`,
          updatePayload,
          {
            headers: { 'Content-Type': 'application/ld+json' },
          },
        ),
      );
      this.logger.log('Successfully updated Orion entity with weather data.');
    } catch (e) {
      if (e instanceof AxiosError) {
        this.logger.error('Failed to push update to Orion:', e.message);
      }
    }
  }

  private async getWeatherData(): Promise<WeatherData | null> {
    const city = 'Athens';
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${this.weatherApiKey}&units=metric`;

    try {
      const response: AxiosResponse<OpenWeatherMapResponse> =
        await firstValueFrom(this.httpService.get<OpenWeatherMapResponse>(url));

      if (
        response?.data?.main?.temp !== undefined &&
        response?.data?.main?.humidity !== undefined
      ) {
        return {
          temperature: response.data.main.temp,
          humidity: response.data.main.humidity,
        };
      }

      this.logger.error('Weather data missing expected structure');
      return null;
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(`Weather API failed: ${error.message}`);
      }
      return null;
    }
  }
}
