import { ConfigService } from "@nestjs/config";
import { ClientProxy } from "@nestjs/microservices";

export interface NatsJetStreamModuleOptions {
  servers?: string[];
  clientName?: string;
  streamName: string;
  consumerName: string;
  filterSubject: string; // * THIS SHOULD MATCH EACH PARTICULAR CONSUMER FILTER SUBJECT
  clientProxy: ClientProxy; // Injected by ClientsModule
  configService: ConfigService;
}

export type CodecType = Record<any, any>; // * Jetstream messages decode their data

export interface NatsJetStreamMessage<T> {
  subject?: string;
  ack: () => void;
  data: T;
  nack: (millis?: number) => void;
  working: () => void;
  term: (reason?: string) => void;
}
