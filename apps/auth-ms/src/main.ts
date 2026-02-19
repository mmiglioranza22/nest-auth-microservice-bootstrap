import { config } from '@dotenvx/dotenvx';

config({
  path: `./config/.env.${process.env.NODE_ENV}`,
  strict: true,
});

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

const isNotProd = process.env.NODE_ENV !== 'production';

export async function bootstrap() {
  const logger = new NestLogger('Auth-ms');

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
  await app.listen(process.env.PORT ?? 3001);

  logger.log(`Auth-ms running and listening on port ${process.env.PORT}`);
}

void bootstrap();
