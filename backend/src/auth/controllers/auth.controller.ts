import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { HTTP_CONFIG } from '../../common/http-config.js';
import type { HttpConfig } from '../../common/http-config.js';
import { LoginDto, RegisterDto } from '../dto/auth.dto.js';
import type { AuthUserResponse } from '../dto/auth.dto.js';
import { LogInUserCommand } from '../commands/log-in-user.js';
import { LogOutUserCommand } from '../commands/log-out-user.js';
import { RegisterUserCommand } from '../commands/register-user.js';
import { GetCurrentUserQuery } from '../queries/get-current-user.js';
import { readSessionId, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, sessionCookieOptions } from '../session.js';
import type { AuthenticatedSession, StartedSession } from '../session.js';
import { CurrentSession, SessionGuard } from '../session.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(HTTP_CONFIG) private readonly config: HttpConfig,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserResponse> {
    const command = new RegisterUserCommand(body.fullName, body.email, body.password, readSessionId(request));
    return this.startSession(response, await this.commandBus.execute(command));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserResponse> {
    const command = new LogInUserCommand(body.email, body.password, readSessionId(request));
    return this.startSession(response, await this.commandBus.execute(command));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  async logout(
    @CurrentSession() { sessionId }: AuthenticatedSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.commandBus.execute(new LogOutUserCommand(sessionId));
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(this.config.secureCookies));
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentSession() { session }: AuthenticatedSession): Promise<AuthUserResponse> {
    return this.queryBus.execute(new GetCurrentUserQuery(session));
  }

  private startSession(response: Response, { user, sessionId }: StartedSession): AuthUserResponse {
    response.cookie(SESSION_COOKIE_NAME, sessionId, {
      ...sessionCookieOptions(this.config.secureCookies),
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
    return user;
  }
}
