import * as ErrorMessages from 'src/common/constants/error-messages';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JsonWebTokenError,
  JwtService,
  JwtSignOptions,
  TokenExpiredError,
} from '@nestjs/jwt';

import { UnauthorizedRpcException } from 'src/common/exceptions/unauthorized-rpc.exception';
import { BadRequestRpcException } from 'src/common/exceptions/bad-request-rpc.exception';
import { InternalServerRpcException } from 'src/common/exceptions/internal-server-rpc.exception';

import { AuthUserService } from 'src/resources/auth/modules/auth-user/auth-user.service';
import { MailService } from 'src/infra/mail/mail.service';
import { OtpAuthenticationService } from './modules/otp/otp-authentication.service';
import { RecoveryTokenService } from './modules/recovery-token/recovery-token.service';
import { CacheService } from 'src/infra/cache/cache.service';

import { type JwtPayload } from './interfaces/jwt-payload.interface';
import { type RequestAgent } from './interfaces/request-agent.interface';
import { type UserTokens } from './interfaces/user-tokens.interface';
import { type EnvVariables } from 'config/env-variables';

import { LoginSlugDTO } from './dto/request/login-slug.dto';
import { ResetPasswordDTO } from './dto/request/reset-password.dto';
import { LoginUserDTO } from './dto/request/login-user.dto';
import { SignUpUserDTO } from './dto/request/signup-user.dto';
import { VerifyAccountDTO } from './dto/request/verify-account.dto';

import { AuthUser } from 'src/resources/auth/modules/auth-user/entities/auth-user.entity';
import { UserRole } from 'src/resources/auth/modules/role/enum/user-role.enum';
import { checkHash, generateHash, generateRandomUUID } from 'src/utils';
import { NatsJetStreamService } from '@packages/nats-jetstream-transport-module';
// import { NatsJetStreamService } from 'src/infra/transport/nats-jetstream.service';

//  RULE OF THUMB: Clear cache / tokens if we know the flow assures is the actual user doing that action (not a malicious one abusing public endpoints)
// wherever token are created/updated/deleted in db, do accordingly in cache and cookies
@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly authUserService: AuthUserService,
    private readonly jwtService: JwtService,
    private readonly recoveryTokenService: RecoveryTokenService,
    private readonly mailService: MailService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService<EnvVariables>,
    private readonly otpService: OtpAuthenticationService,
    private readonly natsJetStreamService: NatsJetStreamService,
  ) {}

  handleNatsJetstreamMessages(payload: any) {
    console.log({ payload });
    console.log('hellor from auth service method');
  }

  onModuleInit() {
    // * Bind methods that should be called when a NATS sends a message through jetstream (outbox pattern)
    this.natsJetStreamService.registerHook(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.handleNatsJetstreamMessages.bind(this),
    );
  }

  async signupUser(signUpUserDto: SignUpUserDTO): Promise<void> {
    const user = await this.authUserService.createUser({
      ...signUpUserDto,
      roles: [UserRole.SYS_ADMIN],
    });

    if (!user) {
      throw new InternalServerRpcException(ErrorMessages.SIGNUP_ERROR);
    }

    console.log({ user });
    await this.natsJetStreamService.publishEvent(
      'auth.user.*',
      JSON.stringify({ data: user }),
    );
    // * could change if EVP gets passed (Email Verification Protocol)
    // await this.mailService.sendAccountVerification(user.email);
  }

  async verifyAccount({ email, code }: VerifyAccountDTO): Promise<void> {
    const user = await this.authUserService.findOneBySlug({ slug: email });

    if (!user || !user.active) {
      throw new UnauthorizedRpcException(
        ErrorMessages.INVALID_USER_CREDENTIALS,
      );
    }

    if (user.verifiedAccount) {
      throw new BadRequestRpcException(ErrorMessages.ACCOUNT_ALREADY_VERIFIED);
    }

    const { valid } = await this.otpService.verifyCode(code);

    if (!valid) {
      throw new BadRequestRpcException(
        ErrorMessages.INVALID_ACCOUNT_VERIFICATION_CODE,
      );
    }
    await this.authUserService.verifyUserAccount(user);
    // await this.mailService.accountConfirmation(user) // TODO
  }

  async loginUser(loginUserDto: LoginUserDTO): Promise<UserTokens> {
    const user = await this.authUserService.findOneBySlug(loginUserDto);

    if (!user || !(await checkHash(loginUserDto.password, user.hash))) {
      throw new UnauthorizedRpcException(
        ErrorMessages.INVALID_USER_CREDENTIALS,
      );
    }

    if (!user.active) {
      throw new UnauthorizedRpcException(ErrorMessages.INACTIVE_USER);
    }

    if (!user.verifiedAccount) {
      throw new BadRequestRpcException(
        ErrorMessages.PENDING_ACCOUNT_VERIFICATION,
      );
    }

    // * Create new tokens on every login (rotate refesh token)
    const {
      accessToken,
      refreshToken,
      refreshTokenHash: refreshTokenCheck,
    } = await this.createUserTokens(user.id, user.id);

    //  ? Rotating refresh token in cache forces single device login (review if multiple device login is desired)
    await this.rotateTokens(user, refreshTokenCheck);

    return { accessToken, refreshToken };
  }

  async logoutUser(userRefreshToken: string): Promise<void> {
    // TODO this should be a specific method
    const payload: { sub: string } = await this.jwtService.verifyAsync(
      userRefreshToken,
      {
        secret: this.configService.getOrThrow('JWT_REFRESH_TOKEN_SECRET', {
          infer: true,
        }),
      },
    );
    await this.cacheService.invalidate(payload.sub);
  }

  async revokeUserAccess(userId: string, agent: RequestAgent): Promise<void> {
    if (userId === agent.id) {
      throw new BadRequestRpcException(ErrorMessages.IMPOSSIBLE_ACTION_TO_SELF);
    }

    await Promise.all([
      this.authUserService.deactivateUser(userId, agent), // * future logins will fail, user can't access protected resources (no need to wait for refresh token expiry -> UserRoleGuard checks cache on request)
      this.cacheService.invalidate(userId), // no longer granted access through cache
    ]);
  }

  // * Users can only refresh their own valid tokens (sent via cookies)
  // * Main login: check refresh token (valid, not expired and in cache db), then find user in db and check if user passes checks. If ok, rotate old refresh tokens and  generate new tokens
  async revalidateUserTokens(cookieRefreshToken: string): Promise<UserTokens> {
    const verifiedToken = await this.verifyUserRefreshToken(cookieRefreshToken);

    if (!verifiedToken || !verifiedToken?.isValid) {
      throw new UnauthorizedRpcException(ErrorMessages.INVALID_REFRESH_TOKEN);
    }

    // * Generate new tokens
    const {
      accessToken,
      refreshToken,
      refreshTokenHash: refreshTokenCheck,
    } = await this.createUserTokens(
      verifiedToken.user.id,
      verifiedToken.user.id,
    );

    // * Rotate refresh token in cache
    await this.rotateTokens(verifiedToken.user, refreshTokenCheck);

    return { accessToken, refreshToken };
  }

  async recoverCredentials(loginSlugDto: LoginSlugDTO) {
    console.log('entra aca');
    const user = await this.authUserService.findOneBySlug(loginSlugDto);

    const validatedUser = this.userCanPerformAction(user);
    if (validatedUser) {
      const recoveryToken = await this.recoveryTokenService.rotateRecoveryToken(
        validatedUser.id,
      );

      await this.mailService.sendRecoveryToken(
        validatedUser.email,
        recoveryToken,
      );
    }
    // fail silently, although it could monitor ip request
  }

  async resetUserPassword({
    password,
    recoveryToken,
  }: ResetPasswordDTO): Promise<void> {
    const token =
      await this.recoveryTokenService.getRecoveryToken(recoveryToken);

    if (!token || token.expiresAt.getTime() < Date.now()) {
      throw new BadRequestRpcException(ErrorMessages.INVALID_RECOVERY_TOKEN);
    }

    const user = await this.authUserService.findOneById(token.userId);

    const validatedUser = this.userCanPerformAction(user);

    if (validatedUser) {
      await Promise.all([
        // * Set new password
        this.authUserService.updateUserPassword(validatedUser, password),
        // * Remove recovery tokens (one time use)
        this.recoveryTokenService.removeUserRecoveryTokens(validatedUser.id),
        // * Invalidate existing refresh tokens in cache (case: stolen credentials - tokens, password)
        this.cacheService.invalidate(validatedUser.id),
      ]);
    }
  }

  private async createUserTokens(
    accessTokenSub: string,
    refreshTokenSub: string,
  ): Promise<
    UserTokens & {
      refreshTokenHash: string;
    }
  > {
    const random = generateRandomUUID();
    const hash = await generateHash(random);
    return {
      accessToken: this.signToken(
        { sub: accessTokenSub },
        { algorithm: 'RS256' }, // default set in JwtModule
      ),
      refreshToken: this.signToken(
        { sub: refreshTokenSub, check: random },
        {
          algorithm: 'HS256',
          secret: this.configService.getOrThrow('JWT_REFRESH_TOKEN_SECRET', {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow('JWT_REFRESH_TOKEN_TTL', {
            infer: true,
          }),
        },
      ),
      refreshTokenHash: hash,
    };
  }

  private signToken(
    { sub, ...payload }: JwtPayload,
    options?: JwtSignOptions,
  ): string {
    return this.jwtService.sign({ sub, ...payload }, options);
  }

  // * Only token check related logic (verify refresh jwt token integrity, check if sub has a user in db, check if that user exists, can perform actions AND is has a saved token in cache)
  private async verifyUserRefreshToken(
    userRefreshToken: string,
  ): Promise<{ isValid: boolean; user: AuthUser } | undefined> {
    try {
      // * Check token integrity and get user id from payload
      const payload: JwtPayload = await this.jwtService.verifyAsync(
        userRefreshToken,
        {
          secret: this.configService.getOrThrow('JWT_REFRESH_TOKEN_SECRET', {
            infer: true,
          }),
        },
      );

      // * Check user in db (might not exist)
      const user = await this.authUserService.findOneById(payload.sub);

      // * Check user exists and can interact with resources
      const validatedUser = this.userCanPerformAction(user); // verifiedAccount account check here is redundant

      // * Check if the user in the refresh token paylod had a saved token in cache
      const isValid = await this.cacheService.validate(
        validatedUser.id,
        payload.check!,
      );

      return { isValid, user: validatedUser };
    } catch (error: unknown) {
      if (error instanceof TokenExpiredError) {
        throw new TokenExpiredError(
          ErrorMessages.EXPIRED_REFRESH_TOKEN,
          error.expiredAt,
        );
      } else if (error instanceof JsonWebTokenError) {
        // could be send event to monitoring with request timestamp, ip and userid
        // * cached token should not be invalidated since valid user does not need to be affected by an attacker's attempt
        throw new UnauthorizedRpcException(
          ErrorMessages.TAMPERED_REFRESH_TOKEN,
        );
      } else {
        // bubbles up specific userCanPerformAction errors
        throw error;
      }
    }
  }

  private async rotateTokens(
    user: AuthUser,
    refreshTokenHash: string,
  ): Promise<void> {
    await this.cacheService.invalidate(user.id);
    await this.cacheService.insert(user, refreshTokenHash);
  }

  private userCanPerformAction(user: AuthUser | null): AuthUser {
    if (!user) {
      throw new UnauthorizedRpcException(
        ErrorMessages.INVALID_USER_CREDENTIALS,
      );
    }

    if (!user.active) {
      throw new UnauthorizedRpcException(ErrorMessages.INACTIVE_USER);
    }

    if (!user.verifiedAccount) {
      throw new BadRequestRpcException(
        ErrorMessages.PENDING_ACCOUNT_VERIFICATION,
      );
    }

    return user;
  }
}
