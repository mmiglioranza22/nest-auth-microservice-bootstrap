/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { BaseRpcExceptionFilter, RpcException } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { EnvVariables } from 'config/env-variables';
import { Status } from '@grpc/grpc-js/build/src/constants';
import {
  EntityNotFoundError,
  QueryFailedError,
  TransactionNotStartedError,
  TypeORMError,
  UpdateValuesMissingError,
} from 'typeorm';
import {
  INVALID_SIGNUP_USER_VALUES,
  NOT_FOUND_REQUESTED_ENTITY,
} from 'src/common/constants/error-messages';

// ? shared lib
interface InternalRpcErrorResponse {
  origin: string;
  code: string | number;
  error?: { statusCode?: string | number; message?: string; type?: string };
  message?: string;
}

// * This should be a shared module in all microservices
// Each microservice is responsible for adapting to the api gateway filter response interface
// as errors vary, api gateway manages its own errors and transmits ms errors via a stardarized contract
@Catch()
export class RpcGlobalExceptionFilter extends BaseRpcExceptionFilter<any> {
  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService<EnvVariables>,
  ) {
    super();
    this.logger.setContext(RpcGlobalExceptionFilter.name);
  }

  private get allowLogs() {
    return (
      this.configService.get('NODE_ENV') !== 'production' &&
      this.configService.get('NODE_ENV') !== 'ci'
    );
  }

  catch(exception: unknown, host: ArgumentsHost): Observable<any> {
    const ctx = host.switchToRpc();
    const rpcCtx = ctx.getContext<any>();
    const ctxData = ctx.getData<any>();

    // ! Change to !== 'production' to check error logs in integration tests
    if (this.allowLogs) {
      // * logger happen AFTER console.logs
      this.logger.debug({
        rpcCtx,
        ctxData,
        env: this.configService.getOrThrow('NODE_ENV', { infer: true }),
        timestamp: new Date().toISOString(),
        constructor: exception?.constructor,
      });
      this.logger.error(exception);
      // console.log(Object.entries(exception as Record<any, any>));
    }

    let mappedException: InternalRpcErrorResponse = {
      origin: 'auth-ms',
      code: Status.INTERNAL, // ? can be modified for mapped errors (shared lib)
    };

    // * Check unhandled redis error and correct config
    if (exception instanceof Object) {
      // console.log(Object.entries(exception as Record<any, any>));
      if ('name' in exception) {
        mappedException.error = { type: exception.name as string };
      }
    }

    if (exception instanceof RpcException) {
      mappedException = { ...mappedException, ...(exception as object) };
    }

    // * Database connection error
    if (exception instanceof AggregateError) {
      mappedException = { ...mappedException, ...(exception as object) };
      mappedException.message = 'Something went wrong';
      mappedException.error = { type: AggregateError.name };
    }
    // * TypeORM errors
    if (exception instanceof TypeORMError) {
      mappedException = { ...mappedException, ...(exception as object) };

      const parsedMessage = exception.message
        ? exception.message.replace(/(?:\r\n|\r|\n)/g, ' ')
        : 'Missing error message';
      // const serverError = existingDbEntities.some((name) =>
      //   exception.message.includes(name),
      // );
      mappedException.message = parsedMessage;

      if (exception instanceof TransactionNotStartedError) {
        // console.log(Object.entries(exception.driverError));
        // errorResponse.message = parsedMessage;
        // errorResponse.statusCode = HttpStatus.BAD_REQUEST;
        mappedException.error = {
          type: exception.name,
          statusCode: HttpStatus.BAD_REQUEST,
        };
      }

      if (exception instanceof QueryFailedError) {
        // console.log(Object.entries(exception.driverError));
        // errorResponse.message = parsedMessage;
        // errorResponse.statusCode = HttpStatus.BAD_REQUEST;
        mappedException.message = exception.name;
        mappedException.error = {
          message: exception.driverError.detail,
          type: exception.driverError.table,
          statusCode: HttpStatus.BAD_REQUEST,
        };

        // * User create
        if (
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          exception.driverError?.detail?.includes('username') ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          exception.driverError?.detail?.includes('email')
        ) {
          mappedException.message = INVALID_SIGNUP_USER_VALUES;
          mappedException.error = {
            message: exception.driverError.detail,
            type: exception.driverError.table,
          };
        }
      }

      if (exception instanceof EntityNotFoundError) {
        mappedException.message = exception.message.split('matching')[0];
        mappedException.error = {
          statusCode: HttpStatus.BAD_REQUEST,
          message: NOT_FOUND_REQUESTED_ENTITY,
          type: exception.name,
        };
        // errorResponse.details = NOT_FOUND_REQUESTED_ENTITY;
        // errorResponse.statusCode = HttpStatus.BAD_REQUEST;
      }

      if (exception instanceof UpdateValuesMissingError) {
        mappedException.message = exception.message;
        mappedException.error = { message: exception.name };
      }
    }

    return super.catch(new RpcException(mappedException), host);
  }
}
