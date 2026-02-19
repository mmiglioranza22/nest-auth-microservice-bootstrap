// https://stackoverflow.com/questions/65486947/nestjs-transform-a-property-using-validationpipe-before-validation-execution-dur
import { config } from '@dotenvx/dotenvx';

config({
  path: `./config/.env.${process.env.NODE_ENV}`,
  strict: true,
});

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import { AppModule } from './app.module';
import { NatsJetStreamService } from './infra/transport/nats-jetstream.service';

const isNotProd = process.env.NODE_ENV !== 'production';

export async function bootstrap() {
  const logger = new NestLogger('Main app');

  const app = await NestFactory.create(AppModule);

  const natsServers: string[] = process.env.NATS_SERVERS!.split(',');

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.NATS,
      options: {
        servers: natsServers,
      },
    },
    { inheritAppConfig: true }, // * to inherit APP_FILTER
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.startAllMicroservices();
  await app.listen(1); // anti pattern
  logger.log(`Main backend api running`);
}

void bootstrap();
