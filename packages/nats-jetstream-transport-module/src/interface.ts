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
}
