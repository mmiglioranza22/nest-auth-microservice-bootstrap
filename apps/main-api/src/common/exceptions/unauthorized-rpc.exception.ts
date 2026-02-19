import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

export class UnauthorizedRpcException extends RpcException {
  constructor(message: string) {
    super({
      statusCode: HttpStatus.UNAUTHORIZED,
      message,
      type: UnauthorizedException.name,
    });
  }
}
