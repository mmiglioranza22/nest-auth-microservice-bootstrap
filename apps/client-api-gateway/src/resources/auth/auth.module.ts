import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CsrfTokenModule } from './modules/csrf-token/csrf-token.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CsrfTokenModule,
  ],
  controllers: [AuthController],
  providers: [JwtStrategy],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
