// * Mind for response object: why we user passthrough  https://docs.nestjs.com/controllers#library-specific-approach
// Nextjs cookie https://www.youtube.com/watch?v=2ZEFTpchGZo
import * as Constants from './constants';
import { Response } from 'express';
import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvVariables } from 'config/env-variables';

import { AuthService } from './auth.service';
// import { CsrfTokenService } from './modules/csrf-token/csrf-token.service';

import { LoginUserDTO } from './dto/request/login-user.dto';
import { SignUpUserDTO } from './dto/request/signup-user.dto';
import { UserIdDTO } from './dto/request/user-id.dto';
import { LoginSlugDTO } from './dto/request/login-slug.dto';
import { ResetPasswordDTO } from './dto/request/reset-password.dto';
import { VerifyAccountDTO } from './dto/request/verify-account.dto';

// import { type SignedCookies } from './interfaces/signed-cookies.interface';
import { type RequestAgent } from './interfaces/request-agent.interface';
// import { UserRole } from 'src/resources/auth/modules/role/enum/user-role.enum';
// import { AuthorizedRoles } from './decorators/authorized-roles/authorized-roles.decorator';
// import { GetUser } from './decorators/get-user/get-user.decorator';
// import { Cookies } from './decorators/cookies/cookies.decorator';
// import { CsrfCheck } from './decorators/csrf-check/csrf-check.decorator';
// import { Private } from './guards/private/private.decorator';
// import { ApiTags } from '@nestjs/swagger';
// import { API_TAG } from 'src/swagger/constants';

import {
  ClientProxy,
  Ctx,
  EventPattern,
  MessagePattern,
  NatsContext,
  Payload,
} from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { UserTokens } from './interfaces/user-tokens.interface';
import { NatsJetStreamService } from 'src/infra/transport/nats-jetstream.service';
import type { JsMsg } from 'nats';

// import { NATS_SERVICE } from 'src/infra/constants/services';
// import { firstValueFrom } from 'rxjs';

// * Auth to be moved
// @ApiTags(API_TAG.Auth.name)
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<EnvVariables>,
    private readonly natsJetStreamService: NatsJetStreamService,
  ) {}

  // @Post('test/jetstream/publish')
  // async testPublish(@Body() payload: any) {
  //   await this.natsJetStreamService.publishEvent(
  //     'auth.user.hola',
  //     'dalebocass',
  //   );
  // }
  // TEST JETSTREAMS (from client gateway)
  // @MessagePattern('test.jetstream.publish') // * This is required exlusively for delivery
  // async testConsume(@Payload() payload: any, @Ctx() context: NatsContext) {
  //   try {
  //     console.log({ payload, context });
  //     await this.natsJetStreamService.publishEvent(
  //       'auth.user.hola',
  //       'dalebocass',
  //     );

  //     return 'ok';
  //   } catch (err: unknown) {
  //     console.log(err);
  //   }
  // }

  // ? ___ Messages ___

  // * ____ PUBLIC ____
  @EventPattern('auth.signup.user')
  async signup(
    @Payload() signUpUserDto: SignUpUserDTO,
    @Ctx() context: NatsContext,
  ): Promise<void> {
    await this.authService.signupUser(signUpUserDto);
  }

  @MessagePattern('auth.verify.account')
  async signupConfirmation(
    @Payload() verifyAccountDto: VerifyAccountDTO,
  ): Promise<void> {
    await this.authService.verifyAccount(verifyAccountDto);
  }

  @MessagePattern('auth.login.user')
  async login(@Payload() loginUserDto: LoginUserDTO): Promise<UserTokens> {
    const { accessToken, refreshToken } =
      await this.authService.loginUser(loginUserDto);
    return { accessToken, refreshToken };
  }

  @MessagePattern('auth.recover.credentials')
  async recoverCredentials(
    @Payload() loginSlugDto: LoginSlugDTO,
  ): Promise<void> {
    await this.authService.recoverCredentials(loginSlugDto);
  }

  @MessagePattern('auth.reset.password')
  async resetPassword(
    @Payload() { password, recoveryToken }: ResetPasswordDTO,
  ): Promise<void> {
    await this.authService.resetUserPassword({ password, recoveryToken });
  }

  @MessagePattern('auth.logout.user')
  async logout(@Payload() userRefreshToken: string): Promise<void> {
    // NestJS will internally wrap the returned Promise into an Observable that:
    // Emits undefined, Then completes
    await this.authService.logoutUser(userRefreshToken);
  }

  @MessagePattern('auth.revoke.user.access')
  async denyUserAccess(
    @Payload() { userId, agent }: { userId: string; agent: RequestAgent },
  ): Promise<void> {
    await this.authService.revokeUserAccess(userId, agent);
  }

  @MessagePattern('auth.revalidate.credentials')
  async revalidateCredentials(
    @Payload() cookieRefreshToken: string,
  ): Promise<UserTokens> {
    const { accessToken, refreshToken } =
      await this.authService.revalidateUserTokens(cookieRefreshToken);

    return { accessToken, refreshToken };
  }

  // ? ___ Events ___

  // TODO: delete user
  // TODO: update user (email, password) -> checks are done in main app user service
}
