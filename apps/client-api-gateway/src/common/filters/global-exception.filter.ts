/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// https://stackoverflow.com/questions/54727103/nestjs-how-to-pass-the-error-from-one-error-filter-to-another
// https://stackoverflow.com/questions/58993405/how-can-i-handle-typeorm-error-in-nestjs
// https://auth0.com/blog/forbidden-unauthorized-http-status-codes/
// https://github.com/typeorm/typeorm/tree/master/src/error

// On null return: https://softwareengineering.stackexchange.com/questions/120355/is-it-better-to-return-null-or-empty-values-from-functions-methods-where-the-ret
import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { PinoLogger } from 'nestjs-pino';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { NatsError } from 'nats';
import { type EnvVariables } from 'config/env-variables';

interface ErrorResponse {
  message: string;
  error: string;
  statusCode: number | string;
  details?: any;
}

interface InternalRpcErrorResponse {
  origin: string;
  code: string | number;
  error?: { statusCode: string | number; message: string; type: string };
  message?: string;
}

// TODO should actually listen to specific RpcExceptions in general and only check specific HttpExceptions (for things related to the api gateway exclusively)
// This main filter should go to main-backend-api ms
@Catch()
export class GlobalExceptionsFilter extends BaseExceptionFilter<any> {
  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService<EnvVariables>,
  ) {
    super();
    this.logger.setContext(GlobalExceptionsFilter.name);
  }

  private get allowLogs() {
    return (
      this.configService.get('NODE_ENV') !== 'production' &&
      this.configService.get('NODE_ENV') !== 'ci'
    );
  }

  catch(exception: unknown, host: ArgumentsHost) {
    // console.log(Object.entries(exception as Record<any, any>));
    // console.log(exception instanceof Error);
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<ExpressRequest>();
    const response = ctx.getResponse<ExpressResponse>();

    // ! Change to !== 'production' to check error logs in integration tests
    if (this.allowLogs) {
      this.logger.debug({
        method: request.method,
        path: request.url,
        env: this.configService.get('NODE_ENV'),
        timestamp: new Date().toISOString(),
        constructor: exception?.constructor,
        // * errors from microservices
        origin:
          exception instanceof Object && 'origin' in exception
            ? exception.origin
            : undefined,
        code:
          exception instanceof Object && 'code' in exception
            ? exception.code
            : undefined,
      });
      this.logger.error(exception);
    }

    const errorResponse: ErrorResponse = {
      message: 'Something went wrong',
      error: 'Internal Server Error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      details: 'Check logs',
    };

    // * Errors sent from microservices as specific HttpError
    // ? NestJS does not persist exception instance, it catchs as generic object
    // ! See how this plays with other type of errors
    // * All error types to be sent formatted: Each ms has the job to format errors to specific interface
    if (
      exception instanceof Object &&
      'origin' in exception &&
      'code' in exception
    ) {
      const rpcException = new RpcException(exception);
      const exceptionResponse =
        rpcException.getError() as InternalRpcErrorResponse;

      errorResponse.message =
        exceptionResponse.message ?? errorResponse.message;
      errorResponse.error = exceptionResponse.error?.type ?? 'RpcException'; // TODO refactor: mapping should be done here. Dev could send error but prod should be generic
      errorResponse.statusCode = exceptionResponse.error?.statusCode ?? 500;
      errorResponse.details = { code: exception.code };
    }

    if (exception instanceof HttpException) {
      // * Redis error catched here for the time being
      super.catch(exception, host); // TODO actually this should be the default if any other case does not match, refactor to move it to the end
      return;
    } else {
      // // * Authentication, Authorization and Validation errors are already handled by BaseExceptionFilter

      // TODO check how to typesafe this
      // * TCP/NATS error
      if (exception instanceof NatsError) {
        console.log('nats error');
        // errorResponse.message = 'TCP Error';
        // errorResponse.error = exception.name;
        errorResponse.details = exception.message;
      }
      // * Database connection error
      // if (exception instanceof AggregateError) {
      //   // console.log(exception);
      //   // console.log(Object.entries(exception));
      //   // const errors = exception.errors.map((err: unknown) => {
      //   //   return { code: err.code, };
      //   // });

      //   errorResponse.message = exception.name;
      //   errorResponse.error = exception.errors[0].code;
      //   errorResponse.details = 'Check database logs';
      // }

      // * TypeORM errors
      // if (exception instanceof TypeORMError) {
      //   const parsedMessage = exception.message
      //     ? exception.message.replace(/(?:\r\n|\r|\n)/g, ' ')
      //     : 'Missing error message';
      //   // const serverError = existingDbEntities.some((name) =>
      //   //   exception.message.includes(name),
      //   // );

      //   if (exception instanceof TransactionNotStartedError) {
      //     // console.log(Object.entries(exception.driverError));
      //     errorResponse.message = parsedMessage;
      //     errorResponse.statusCode = HttpStatus.BAD_REQUEST;
      //     errorResponse.error = exception.name;
      //   }

      //   if (exception instanceof QueryFailedError) {
      //     // console.log(Object.entries(exception.driverError));
      //     errorResponse.message = parsedMessage;
      //     errorResponse.statusCode = HttpStatus.BAD_REQUEST;
      //     errorResponse.error = exception.name;
      //     errorResponse.details = {
      //       detail: exception.driverError.detail,
      //       field: exception.driverError.table,
      //     };

      //     // * User create
      //     if (
      //       exception.driverError?.detail?.includes('username') ||
      //       exception.driverError?.detail?.includes('email')
      //     ) {
      //       errorResponse.message = INVALID_SIGNUP_USER_VALUES;
      //       errorResponse.details = {
      //         detail: exception.driverError.detail,
      //         field: exception.driverError.table,
      //       };
      //     }
      //   }

      //   if (exception instanceof EntityNotFoundError) {
      //     errorResponse.message = exception.message.split('matching')[0];
      //     errorResponse.error = exception.name;
      //     errorResponse.details = NOT_FOUND_REQUESTED_ENTITY;
      //     errorResponse.statusCode = HttpStatus.BAD_REQUEST;
      //   }

      //   if (exception instanceof UpdateValuesMissingError) {
      //     errorResponse.message = exception.message;
      //     errorResponse.error = exception.name;
      //   }
      // }

      // * Cache errors (token related)
      if (
        exception instanceof TokenExpiredError ||
        exception instanceof JsonWebTokenError
      ) {
        // * Auth errors
        errorResponse.message = exception.message;
        errorResponse.error = exception.name;
        errorResponse.statusCode = HttpStatus.UNAUTHORIZED;
        delete errorResponse.details;
      }

      response.status(Number(errorResponse.statusCode)).json(errorResponse);
    }
  }
}
