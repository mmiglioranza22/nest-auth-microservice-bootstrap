import { readFileSync } from 'fs';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { type EnvVariables } from 'config/env-variables';

import { AuthUserModule } from 'src/resources/auth/modules/auth-user/auth-user.module';
import { AuthService } from './auth.service';
import { MailModule } from 'src/infra/mail/mail.module';
import { RecoveryTokenModule } from 'src/resources/auth/modules/recovery-token/recovery-token.module';
import { CacheModule } from 'src/infra/cache/cache.module';
import { DatabaseModule } from 'src/infra/database/database.module';
import { OtpAuthenticationModule } from './modules/otp/otp-authentication.module';

import { AuthController } from './auth.controller';
import { JwksController } from './jwks.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvVariables>) => {
        return {
          privateKey: readFileSync(
            join(__dirname, '../../../public/certs/private.pem'), // * ideally read this from infra config, pipeline or env variable
            'utf8',
          ),
          signOptions: {
            algorithm: 'RS256',
            issuer: configService.getOrThrow('JWT_TOKEN_ISSUER'), // auth-ms
            audience: configService.getOrThrow('JWT_TOKEN_AUDIENCE'), // api-gateway
            expiresIn: configService.getOrThrow('JWT_ACCESS_TOKEN_TTL'),
            keyid: 'auth-key-1', // REQUIRED for JWKS
          },
        };
      },
    }),
    DatabaseModule,
    AuthUserModule,
    RecoveryTokenModule,
    CacheModule,
    MailModule,
    OtpAuthenticationModule,
  ],
  controllers: [AuthController, JwksController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
