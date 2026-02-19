import { RpcGlobalExceptionFilter } from './rpc-global-exception.filter';

describe('RpcExceptionFilter', () => {
  it('should be defined', () => {
    expect(new RpcGlobalExceptionFilter()).toBeDefined();
  });
});
