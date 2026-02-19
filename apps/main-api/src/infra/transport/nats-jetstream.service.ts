// https://youtu.be/ChSVWDW-874?si=-5_Nliat49bTQESE
// https://github.com/Redningsselskapet/nestjs-plugins/blob/master/packages/nestjs-nats-jetstream-transport/src/client.ts#L85
//
import { HttpAdapterHost } from '@nestjs/core';
import {
  Inject,
  Injectable,
  Optional,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { NATS_SERVICE } from '../constants/services';
import type { ClientProxy } from '@nestjs/microservices';
import {
  AckPolicy,
  JetStreamClient,
  JetStreamManager,
  RetentionPolicy,
  StorageType,
  JSONCodec,
  NatsError,
  Codec,
  type NatsConnection,
  type Stream,
  type Consumer,
  type ConsumerMessages,
  type JetStreamPublishOptions,
  type Payload,
  type JsMsg,
} from 'nats';

import { PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { NATS_JETSTREAM_OPTIONS } from './nats-jetstream.tokens';
import type { NatsJetStreamModuleOptions } from './nats-jetstream-module-options.interface';

@Injectable()
export class NatsJetStreamService
  implements OnModuleDestroy, OnApplicationBootstrap
{
  private natsConnection: NatsConnection;
  private jsClient: JetStreamClient;
  private jsManager: JetStreamManager;
  private readonly streams: Map<string, Stream>; // * no real need except for debugging and ensuring proper jetstream functionality for now. A object/map would be better
  private readonly consumers: Map<string, Consumer>; // * no real need except for debugging and ensuring proper jetstream functionality for now. A object/map would be better
  private readonly codec: Codec<JSON>;
  private hooks: ((payload: any) => Promise<void>)[] = [];

  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly hostAdapter: HttpAdapterHost,
    @Inject(NATS_SERVICE) private readonly clientProxy: ClientProxy,
    @Inject(NATS_JETSTREAM_OPTIONS)
    private readonly options: NatsJetStreamModuleOptions,
  ) {
    this.streams = new Map();
    this.consumers = new Map();
    this.codec = JSONCodec();
    this.logger.setContext(NatsJetStreamService.name);
  }

  registerHook(fn: () => Promise<void>) {
    this.hooks.push(fn);
  }

  async onApplicationBootstrap() {
    await this.clientProxy.connect();
    this.natsConnection = this.clientProxy.unwrap<NatsConnection>();
    this.jsClient = this.natsConnection.jetstream();
    this.jsManager = await this.jsClient.jetstreamManager(); // jetstream should be enabled beforehand in your nats server config (docker, etc)

    await this.initProvisionedNatsConfig();

    if (this.hostAdapter.httpAdapter !== null) {
      this.logger.info(
        `${NatsJetStreamService.name} used in hybrid application. Subscribing to host adapter events...`,
      );
      // ! This works for hybrid apps that uses http servers
      this.hostAdapter.listen$.subscribe({
        // TODO check antipattern alternative
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        complete: async () => {
          // if (!this.options.messageHandler) {
          //   throw Error(
          //     `Missing message callback function for ${this.options.consumerName} consumer in ${this.options.streamName} stream`,
          //   );
          // }
          await this.initConsumeMessagesCycle();
        },
      });
    }
  }

  // * For simplicity, each microservice has 1 consumer in 1 stream (eventually it can be extended to N streams and consumers)
  async initProvisionedNatsConfig() {
    const [stream, consumer] = await Promise.all([
      this.jsManager.streams.get(this.options.streamName),
      this.jsClient.consumers.get(
        this.options.streamName,
        this.options.consumerName,
      ),
    ]);

    if (consumer) {
      this.consumers.set(this.options.consumerName, consumer);
    }

    if (stream) {
      this.streams.set(this.options.streamName, stream);
    }

    this.logger.info(
      `${this.options.streamName} stream and ${this.options.consumerName} durable consumer set`,
    );
  }

  async onModuleDestroy() {
    await this.natsConnection.drain(); // Drain the connection gracefully on application close
  }

  // Example function to publish a message to a stream
  async publishEvent(
    subject: string,
    data: Payload,
    options?: Partial<JetStreamPublishOptions>,
  ) {
    try {
      // todo headers should be set here somehow as an option OR pass as args for dedup
      // https://github.com/Redningsselskapet/nestjs-plugins/issues/45
      // https://nats.io/blog/new-per-subject-discard-policy/
      return await this.jsClient.publish(
        subject,
        JSON.stringify(data),
        options,
      );
    } catch (error: unknown) {
      if (error instanceof NatsError) {
        console.log({
          code: error.code,
          message: error.message,
          name: error.name,
        });
        throw error; // ? avoid this?
      }
    }
  }

  // Example function to subscribe to a stream and handle messages
  async initConsumeMessagesCycle() {
    if (this.consumers.has(this.options.consumerName)) {
      const messages = (await this.consumers
        .get(this.options.consumerName)
        ?.consume()) as ConsumerMessages;
      this.logger.info(`${this.options.consumerName} listening to messages`);

      try {
        //  TODO messages should be already deduped here: check
        // * filter subject done on the config level

        for await (const m of messages) {
          // TODO once monorepo is set: try to implement first in main-api and create signup logic
          if (this.hooks.length > 0) {
            // ? complete message can be sent and handle ack logic upstream
            await this.hooks[0]({
              data: this.codec.decode(m.data),
              subject: m.subject,
              ack: () => m.ack(),
            });
          }
          console.log(m.subject);
          console.log(m.seq);
          // console.log({ data: this.codec.decode(m.data) });
          m.ack();
        }
      } catch (err) {
        this.logger.error(`consume failed: ${err.message}`);
      }
    }
  }

  getNatsConnection(): NatsConnection {
    if (!this.natsConnection) {
      throw new Error(
        'NATS client not initialized or connection not available.',
      );
    }
    return this.natsConnection;
  }

  getStreams(name: string): Stream | undefined {
    if (this.streams.size === 0) {
      throw new Error('NATS stream not initialized.');
    }

    return this.streams.get(name);
  }

  getConsumers(name: string): Consumer | undefined {
    if (this.consumers.size === 0) {
      throw new Error('NATS consumer not initialized.');
    }

    return this.consumers.get(name);
  }

  // Usefull in case logs want to be disabled
  private get allowLogs() {
    return (
      this.configService.get('NODE_ENV') !== 'production' &&
      this.configService.get('NODE_ENV') !== 'ci'
    );
  }
}
