import { ConfigService } from "@nestjs/config";
import { ClientProxy } from "@nestjs/microservices";

// nats-stream.interfaces.ts
export interface NatsJetStreamModuleOptions {
  servers?: string[];
  clientName?: string;
  streamName: string;
  consumerName: string;
  filterSubject: string; // * THIS SHOULD MATCH EACH PARTICULAR CONSUMER FILTER SUBJECT
  clientProxy: ClientProxy;
  configService: ConfigService;
  autoAck?: boolean; // Default is true. All consumers acknowledge messages as these are consumed.
  rawJsMsg?: boolean; // By default is false. Message is sent parsed.
}

export interface NatsJetStreamMessage {
  data?: JSON | string;
  subject?: string;
  ack?: () => void;
}
