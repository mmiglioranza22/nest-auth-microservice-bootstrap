import { ConfigService } from "@nestjs/config";
import { ClientProxy } from "@nestjs/microservices";

// nats-stream.interfaces.ts
export interface NatsJetStreamModuleOptions {
  servers?: string[];
  clientName?: string;
  streamName: string;
  consumerName: string;
  filterSubject: string;
  messageHandler?: (payload?: any) => void | Promise<void>; // todo check this
  clientProxy: ClientProxy;
  configService: ConfigService;
}
