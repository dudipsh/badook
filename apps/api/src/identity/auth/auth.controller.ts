import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OAuthLoginService, OAuthProvider } from './oauth-login.service';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const PROVIDERS: OAuthProvider[] = ['google', 'microsoft'];

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthLogin: OAuthLoginService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── OAuth login (Google / Microsoft 365) ────────────────

  @Get('oauth/:provider')
  startOAuth(@Param('provider') provider: string, @Res() res: Response) {
    const p = this.assertProvider(provider);
    // Stateless CSRF protection: a short-lived signed token bound to the provider.
    const state = this.jwt.sign({ provider: p, kind: 'login_state' }, { expiresIn: '10m' });
    return res.redirect(this.oauthLogin.getAuthorizationUrl(p, state));
  }

  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('frontendUrl') || 'http://localhost:5173';
    try {
      const p = this.assertProvider(provider);
      await this.verifyState(state, p);
      if (!code) throw new BadRequestException('Missing code');

      const email = await this.oauthLogin.getEmailFromCode(p, code);
      const user = await this.oauthLogin.resolveLoginUser(email, p, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      const { accessToken } = this.authService.buildAuthResponse(user);
      return res.redirect(`${frontendUrl}/login#token=${accessToken}`);
    } catch (err: any) {
      const reason = encodeURIComponent(err?.message || 'oauth_failed');
      return res.redirect(`${frontendUrl}/login#error=${reason}`);
    }
  }

  private assertProvider(provider: string): OAuthProvider {
    if (!PROVIDERS.includes(provider as OAuthProvider)) {
      throw new BadRequestException('Unsupported provider');
    }
    return provider as OAuthProvider;
  }

  private async verifyState(state: string, provider: OAuthProvider) {
    if (!state) throw new BadRequestException('Missing state');
    const payload = await this.jwt.verifyAsync(state, {
      secret: this.config.get('jwt.secret'),
    });
    if (payload?.kind !== 'login_state' || payload?.provider !== provider) {
      throw new BadRequestException('Invalid state');
    }
  }

  // ── Profile ─────────────────────────────────────────────

  @Get('me')
  @UseGuards(AuthGuard)
  getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Patch('me/language')
  @UseGuards(AuthGuard)
  updateLanguage(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateLanguageDto,
  ) {
    return this.authService.updateLanguage(userId, dto.language);
  }
}
