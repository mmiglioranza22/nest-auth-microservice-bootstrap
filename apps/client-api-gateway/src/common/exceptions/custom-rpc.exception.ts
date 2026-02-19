import { RpcException } from '@nestjs/microservices';

export class CustomRpcException extends RpcException {
  constructor(error: object) {
    super(error);
  }
}
