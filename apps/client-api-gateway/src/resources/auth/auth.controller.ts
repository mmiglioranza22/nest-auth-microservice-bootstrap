// * Mind for response object: why we user passthrough  https://docs.nestjs.com/controllers#library-specific-approach
// Nextjs cookie https://www.youtube.com/watch?v=2ZEFTpchGZo
import * as Constants from './constants';
import { MISSING_REFRESH_TOKEN } from 'src/common/constants/error-messages';
import { type Response as ExpressResponse } from 'express';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { NATS_SERVICE } from 'src/common/constants/services';
import { defaultIfEmpty, firstValueFrom } from 'rxjs';
import { API_TAG } from 'src/swagger/constants';
import { type EnvVariables } from 'config/env-variables';

import { CsrfTokenService } from './modules/csrf-token/csrf-token.service';

import { LoginUserDTO } from './dto/login-user.dto';
import { SignUpUserDTO } from './dto/signup-user.dto';
import { UserIdDTO } from './dto/user-id.dto';
import { LoginSlugDTO } from './dto/login-slug.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { VerifyAccountDTO } from './dto/verify-account.dto';

import { type SignedCookies } from './interfaces/signed-cookies.interface';
import { type RequestAgent } from './interfaces/request-agent.interface';
import { UserRole } from 'src/resources/auth/modules/role/enum/user-role.enum';
import { AuthorizedRoles } from './decorators/authorized-roles/authorized-roles.decorator';
import { GetUser } from './decorators/get-user/get-user.decorator';
import { Cookies } from './decorators/cookies/cookies.decorator';
import { CsrfCheck } from './decorators/csrf-check/csrf-check.decorator';
import { Private } from './guards/private/private.decorator';
import { ApiTags } from '@nestjs/swagger';
import { UserTokens } from './interfaces/user-tokens.interface';

@ApiTags(API_TAG.Auth.name)
@Controller()
export class AuthController {
  constructor(
    @Inject(NATS_SERVICE) private readonly client: ClientProxy,
    private readonly configService: ConfigService<EnvVariables>,
    private readonly csrfTokenService: CsrfTokenService,
  ) {}

  // * ____ PUBLIC ____
  @HttpCode(HttpStatus.OK)
  @Post('signup')
  async signup(@Body() signUpUserDto: SignUpUserDTO) {
    await firstValueFrom(
      this.client
        .emit('auth.signup.user', signUpUserDto)
        .pipe(defaultIfEmpty(undefined)),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-account')
  async signupConfirmation(@Body() verifyAccountDto: VerifyAccountDTO) {
    await firstValueFrom(
      this.client
        .send<void>('auth.verify.account', verifyAccountDto)
        .pipe(defaultIfEmpty(undefined)),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() loginUserDto: LoginUserDTO,
    @Res({ passthrough: true }) response: ExpressResponse,
  ): Promise<{ accessToken: string }> {
    const { accessToken, refreshToken } = await firstValueFrom<UserTokens>(
      this.client.send('auth.login.user', loginUserDto),
    );

    this.setAuthCookie(refreshToken, response);
    this.setCsrfCookie(response);

    return { accessToken };
  }

  // * Mail service will send a link to the FE page with a given token to be used in POST /api/reset-password
  // * This is the main abusive endpoint:
  // - can't limit request to 1 because mail service could fail
  // - can't use refresh token (used from public endpoint)
  // ? Users can forget either email or username. It must provide one to recover them
  @HttpCode(HttpStatus.OK)
  @Post('recover-credentials')
  async recoverCredentials(
    @Body() loginSlugDto: LoginSlugDTO,
    @Res({ passthrough: true }) response: ExpressResponse,
  ) {
    await firstValueFrom(
      this.client
        .send('auth.recover.credentials', loginSlugDto)
        .pipe(defaultIfEmpty(undefined)),
    );
    // ? Review, might cause undesired UX
    this.clearAllCookies(response);
    response.end();
  }

  // * FE takes token from body (sent via email from /recover-credentials) and sets a form for user to provide new password
  // Long throttle 1 every 30/60 secs
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDTO,
    @Res({ passthrough: true }) response: ExpressResponse,
  ) {
    await firstValueFrom(
      this.client
        .send<void>('auth.reset.password', resetPasswordDto)
        .pipe(defaultIfEmpty(undefined)),
    );

    this.clearAllCookies(response);
    response.end();
  }

  // * ____ PRIVATE / PROTECTED ____

  // User logout relies only refresh token in cookies (checks user id there), expired access token is of no use or importance
  @CsrfCheck()
  @HttpCode(HttpStatus.OK)
  @Post('auth/logout')
  async logout(
    @Cookies('signed') cookies: SignedCookies,
    @Res({ passthrough: true }) response: ExpressResponse,
  ) {
    // Check if cookies were cleared
    if (!(Constants.AUTHENTICATION_COOKIE_HEADER in cookies)) {
      throw new UnauthorizedException(MISSING_REFRESH_TOKEN);
    }
    const { Authentication } = cookies;

    // ? * if message is not awaited (despite being an empty response), cache does not invalidate existing token (cascading issue with promises and observable) !!!
    await firstValueFrom(
      this.client
        .send<void>('auth.logout.user', Authentication)
        .pipe(defaultIfEmpty(undefined)),
    );

    this.clearAllCookies(response);
    response.end();
  }

  @CsrfCheck()
  @Private()
  @AuthorizedRoles(UserRole.SYS_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('auth/deny-access')
  async denyUserAccess(
    @Body() { userId }: UserIdDTO,
    @GetUser() agent: RequestAgent,
  ) {
    await firstValueFrom(
      this.client
        .send<void>('auth.revoke.user.access', { userId, agent })
        .pipe(defaultIfEmpty(undefined)),
    );
  }

  // // * FE could hit this endpoint programatically when access is denied due to expired access token
  @CsrfCheck()
  @HttpCode(HttpStatus.OK)
  @Post('auth/revalidate-credentials')
  async revalidateCredentials(
    @Cookies('signed') cookies: SignedCookies,
    @Res({ passthrough: true }) response: ExpressResponse,
  ): Promise<{ accessToken: string }> {
    // Check if cookies were cleared
    if (!(Constants.AUTHENTICATION_COOKIE_HEADER in cookies)) {
      throw new UnauthorizedException(MISSING_REFRESH_TOKEN);
    }

    const { Authentication } = cookies;
    //? could force redirect to login if cookie is not present
    const { accessToken, refreshToken } = await firstValueFrom<UserTokens>(
      this.client.send('auth.revalidate.credentials', Authentication),
    );

    this.setAuthCookie(refreshToken, response);
    this.setCsrfCookie(response);

    return { accessToken };
  }

  private setAuthCookie(refreshToken: string, response: ExpressResponse): void {
    response.cookie(Constants.AUTHENTICATION_COOKIE_HEADER, refreshToken, {
      sameSite: 'strict',
      httpOnly: true,
      secure: true,
      signed: true,
      path: Constants.AUTH_COOKIE_PATH,
      maxAge: this.configService.getOrThrow('COOKIE_MAX_AGE'),
    });
  }

  private setCsrfCookie(response: ExpressResponse): void {
    response.cookie(
      Constants.CSRF_COOKIE_HEADER,
      this.csrfTokenService.generateCsrfToken(),
      {
        sameSite: 'strict',
        httpOnly: false, // must be readable by JS
        secure: true,
        path: Constants.CSRF_COOKIE_PATH,
        maxAge: this.configService.getOrThrow('COOKIE_MAX_AGE'),
      },
    );
  }

  // https://stackoverflow.com/questions/68332147/i-can-still-edit-cookie-even-with-httponly-using-cookie-editor
  // Always clear cookies on logout
  private clearAllCookies(response: ExpressResponse): void {
    response.clearCookie(Constants.AUTHENTICATION_COOKIE_HEADER, {
      path: Constants.AUTH_COOKIE_PATH,
    });
    response.clearCookie(Constants.CSRF_COOKIE_HEADER, {
      path: Constants.CSRF_COOKIE_PATH,
    });
  }
}
