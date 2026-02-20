// * Mind for response object: why we user passthrough  https://docs.nestjs.com/controllers#library-specific-approach
// Nextjs cookie https://www.youtube.com/watch?v=2ZEFTpchGZo

import { Controller } from '@nestjs/common';

import { AuthService } from './auth.service';

import { LoginUserDTO } from './dto/request/login-user.dto';
import { SignUpUserDTO } from './dto/request/signup-user.dto';
import { UserIdDTO } from './dto/request/user-id.dto';
import { LoginSlugDTO } from './dto/request/login-slug.dto';
import { ResetPasswordDTO } from './dto/request/reset-password.dto';
import { VerifyAccountDTO } from './dto/request/verify-account.dto';

import { type RequestAgent } from './interfaces/request-agent.interface';

import {
  Ctx,
  EventPattern,
  MessagePattern,
  NatsContext,
  Payload,
} from '@nestjs/microservices';

import { UserTokens } from './interfaces/user-tokens.interface';

// * Auth to be moved
// @ApiTags(API_TAG.Auth.name)
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
