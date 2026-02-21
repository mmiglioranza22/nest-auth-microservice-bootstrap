import { ConfigService } from "@nestjs/config";
import { ClientProxy } from "@nestjs/microservices";

export interface NatsJetStreamModuleOptions {
  servers?: string[];
  clientName?: string;
  streamName: string;
  consumerName: string;
  filterSubject: string; // * THIS SHOULD MATCH EACH PARTICULAR CONSUMER FILTER SUBJECT
  clientProxy: ClientProxy;
  configService: ConfigService;
}

export type CodecType = Record<any, any>;

export interface NatsJetStreamMessage {
  subject?: string;
  ack: () => void;
  [propName: string]: CodecType | string | (() => void) | undefined;
}
