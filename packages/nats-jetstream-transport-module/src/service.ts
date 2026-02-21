// https://youtu.be/ChSVWDW-874?si=-5_Nliat49bTQESE
// https://github.com/Redningsselskapet/nestjs-plugins/blob/master/packages/nestjs-nats-jetstream-transport/src/client.ts#L85
//
import { HttpAdapterHost } from "@nestjs/core";
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";

import {
  JetStreamClient,
  JetStreamManager,
  JSONCodec,
  NatsError,
  Codec,
  type NatsConnection,
  type Stream,
  type Consumer,
  type ConsumerMessages,
  type JetStreamPublishOptions,
  type Payload,
} from "nats";

import { PinoLogger } from "nestjs-pino";

import { NATS_JETSTREAM_OPTIONS } from "./tokens";
import {
  CodecType,
  type NatsJetStreamMessage,
  type NatsJetStreamModuleOptions,
} from "./interface";

@Injectable()
export class NatsJetStreamService
  implements OnModuleDestroy, OnApplicationBootstrap
{
  private natsConnection: NatsConnection;
  private jsClient: JetStreamClient;
  private jsManager: JetStreamManager;
  private hooks: ((payload: any) => Promise<void>)[] = [];
  private readonly streams: Map<string, Stream>; // * no real need except for debugging and ensuring proper jetstream functionality for now. A object/map would be better
  private readonly consumers: Map<string, Consumer>; // * no real need except for debugging and ensuring proper jetstream functionality for now. A object/map would be better
  private readonly codec: Codec<CodecType>; // TODO Might not be the best type

  constructor(
    @Inject(NATS_JETSTREAM_OPTIONS)
    private readonly options: NatsJetStreamModuleOptions,
    private readonly hostAdapter: HttpAdapterHost,
    private readonly logger: PinoLogger,
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
    await this.options.clientProxy.connect();
    this.natsConnection = this.options.clientProxy.unwrap<NatsConnection>();
    this.jsClient = this.natsConnection.jetstream();
    this.jsManager = await this.jsClient.jetstreamManager(); // jetstream should be enabled beforehand in your nats server config (docker, etc)

    await this.initProvisionedNatsConfig();

    if (this.hostAdapter.httpAdapter !== null) {
      this.logger.info(
        `${NatsJetStreamService.name} used in hybrid application. Subscribing to host adapter events...`,
      );
      // ! This works only for hybrid apps that uses http servers
      this.hostAdapter.listen$.subscribe({
        // TODO check antipattern alternative
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        complete: async () => {
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
      return await this.jsClient.publish(subject, data, options);
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

  // * filter subject done on the config level
  // TODO For now only one hook can be attached by service
  async initConsumeMessagesCycle() {
    if (this.consumers.has(this.options.consumerName)) {
      const messages = (await this.consumers
        .get(this.options.consumerName)
        ?.consume()) as ConsumerMessages;
      this.logger.info(`${this.options.consumerName} listening to messages`);

      try {
        //  TODO messages should be already deduped here: check!
        for await (const message of messages) {
          if (this.options.filterSubject !== message.subject) {
            throw new Error("Your consumer is not subscribed to this subject");
          }
          if (this.hooks.length > 0) {
            console.log(message.subject);
            console.log(message.seq);
            const message1: NatsJetStreamMessage = {
              data: this.codec.decode(message.data),
              subject: message.subject,
              ack: () => {
                if (this.options.ackMessageInLoop === false) {
                  message.ack();
                } else {
                  console.log("Message acknowledged in loop");
                }
              },
            };
            await this.hooks[0](message1);

            // * Default behaviour, ack messages in loop
            if (
              this.options.ackMessageInLoop === undefined ||
              this.options.ackMessageInLoop === true
            ) {
              message.ack();
            }
          }
        }
      } catch (err) {
        this.logger.error(`consume failed: ${err.message}`);
      }
    }
  }

  getNatsConnection(): NatsConnection {
    if (!this.natsConnection) {
      throw new Error(
        "NATS client not initialized or connection not available.",
      );
    }
    return this.natsConnection;
  }

  getStreams(name: string): Stream | undefined {
    if (this.streams.size === 0) {
      throw new Error("NATS stream not initialized.");
    }

    return this.streams.get(name);
  }

  getConsumers(name: string): Consumer | undefined {
    if (this.consumers.size === 0) {
      throw new Error("NATS consumer not initialized.");
    }

    return this.consumers.get(name);
  }

  // Usefull in case logs want to be disabled
  private get allowLogs() {
    return (
      this.options.configService.get("NODE_ENV") !== "production" &&
      this.options.configService.get("NODE_ENV") !== "ci"
    );
  }
}
