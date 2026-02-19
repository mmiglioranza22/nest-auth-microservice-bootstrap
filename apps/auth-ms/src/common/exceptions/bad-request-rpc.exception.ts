import { BadRequestException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

export class BadRequestRpcException extends RpcException {
  constructor(message: string) {
    super({
      statusCode: HttpStatus.BAD_REQUEST, // Use specific gRPC status code
      message,
      type: BadRequestException.name,
    });
  }
}
