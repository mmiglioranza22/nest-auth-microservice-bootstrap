import { Module } from '@nestjs/common';
import { LoggerModule as NestPinoLoggerModule } from 'nestjs-pino';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import { type EnvVariables } from 'config/env-variables';

const reqSerializerFn = (request: Request) => {
  const logPayload: Record<string, any> = {
    id: request.id,
  };

  if (Object.keys(request.query ?? {}).length) {
    logPayload.query = request.query;
  }

  return logPayload;
};

// TODO CLs wont work in ms, must refactor to middleware and guard to access req id set in api gateway
// https://papooch.github.io/nestjs-cls/considerations/compatibility#nestjs-related-versions-compatibility-matrix
@Module({
  imports: [
    NestPinoLoggerModule.forRootAsync({
      imports: [ClsModule], // TODO might not be needed, or at least should be refactored for ms
      inject: [ClsService, ConfigService],
      useFactory: (
        cls: ClsService,
        configService: ConfigService<EnvVariables>,
      ) => {
        const isProd =
          configService.getOrThrow('NODE_ENV', { infer: true }) ===
          'production';

        return {
          pinoHttp: {
            level: configService.getOrThrow('LOG_LEVEL') ?? 'info',
            genReqId: () => cls.getId(),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            customProps: (req: Request, res: Response) => ({
              context: 'Incoming request',
            }),
            customSuccessMessage: (
              req: Request,
              res: Response,
              responseTime: number,
            ) => {
              return `${req.method} ${req.originalUrl ?? req.url} - ${responseTime}ms [${res.statusCode}]`;
            },
            serializers: {
              req: reqSerializerFn,
              res: () => undefined,
            },

            // * can be disabled for testing too if logs get noisy
            ...(isProd
              ? {}
              : {
                  transport: {
                    target: 'pino-pretty',
                    options: {
                      messageFormat: `[{context}] {msg}`,
                      colorize: true,
                      singleLine: true,
                      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                      ignore: 'pid,hostname,context,responseTime',
                    },
                  },
                }),
          },
        };
      },
    }),
  ],
  providers: [],
})
export class LoggerModule {}
