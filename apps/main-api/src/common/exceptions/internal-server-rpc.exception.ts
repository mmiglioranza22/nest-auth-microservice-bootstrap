import { HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

export class InternalServerRpcException extends RpcException {
  constructor(message: string) {
    super({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR, // Use specific gRPC status code
      message,
      type: InternalServerErrorException.name,
    });
  }
}
