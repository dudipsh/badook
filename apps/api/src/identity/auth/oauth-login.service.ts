import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type OAuthProvider = 'google' | 'microsoft';

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

// Login scopes ONLY — deliberately minimal. This is NOT mailbox access.
const LOGIN_SCOPES = 'openid email profile';

/**
 * Handles OAuth login (sign-in) with Google and Microsoft 365.
 *
 * This is a SEPARATE concern from email-reading OAuth (gmail/outlook
 * integrations). Login requests only `openid email profile`, stores no
 * tokens, and merely resolves a verified email to an existing user.
 * Login is invite-only: the email must already exist and be active.
 */
@Injectable()
export class OAuthLoginService {
  private readonly logger = new Logger(OAuthLoginService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Authorization URLs ──────────────────────────────────

  getAuthorizationUrl(provider: OAuthProvider, state: string): string {
    return provider === 'google'
      ? this.getGoogleAuthUrl(state)
      : this.getMicrosoftAuthUrl(state);
  }

  private getGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get('googleLogin.clientId')!,
      redirect_uri: this.config.get('googleLogin.redirectUri')!,
      response_type: 'code',
      scope: LOGIN_SCOPES,
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `${GOOGLE_AUTH_BASE}?${params}`;
  }

  private getMicrosoftAuthUrl(state: string): string {
    const tenant = this.config.get('msLogin.tenantId') || 'common';
    const params = new URLSearchParams({
      client_id: this.config.get('msLogin.clientId')!,
      redirect_uri: this.config.get('msLogin.redirectUri')!,
      response_type: 'code',
      scope: LOGIN_SCOPES,
      state,
      response_mode: 'query',
      prompt: 'select_account',
    });
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
  }

  // ── Code → verified email ───────────────────────────────

  async getEmailFromCode(provider: OAuthProvider, code: string): Promise<string> {
    return provider === 'google'
      ? this.getGoogleEmail(code)
      : this.getMicrosoftEmail(code);
  }

  private async getGoogleEmail(code: string): Promise<string> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('googleLogin.clientId')!,
        client_secret: this.config.get('googleLogin.clientSecret')!,
        code,
        redirect_uri: this.config.get('googleLogin.redirectUri')!,
        grant_type: 'authorization_code',
      }),
    });
    const data = (await res.json()) as Record<string, any>;
    if (data.error) {
      this.logger.error(`Google token exchange failed: ${data.error_description || data.error}`);
      throw new UnauthorizedException('Google sign-in failed');
    }
    const claims = await this.verifyGoogleIdToken(data.id_token);
    const email = (claims.email || '').toLowerCase();
    if (!email || claims.email_verified === 'false' || claims.email_verified === false) {
      throw new UnauthorizedException('Google email not verified');
    }
    return email;
  }

  private async verifyGoogleIdToken(idToken: string): Promise<Record<string, any>> {
    // Verify the id_token signature/audience via Google's tokeninfo endpoint.
    const res = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
    const claims = (await res.json()) as Record<string, any>;
    if (claims.error || claims.aud !== this.config.get('googleLogin.clientId')) {
      throw new UnauthorizedException('Invalid Google token');
    }
    return claims;
  }

  private async getMicrosoftEmail(code: string): Promise<string> {
    const tenant = this.config.get('msLogin.tenantId') || 'common';
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('msLogin.clientId')!,
        client_secret: this.config.get('msLogin.clientSecret')!,
        code,
        redirect_uri: this.config.get('msLogin.redirectUri')!,
        grant_type: 'authorization_code',
        scope: LOGIN_SCOPES,
      }),
    });
    const data = (await res.json()) as Record<string, any>;
    if (data.error) {
      this.logger.error(`Microsoft token exchange failed: ${data.error_description || data.error}`);
      throw new UnauthorizedException('Microsoft sign-in failed');
    }
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const profile = (await profileRes.json()) as Record<string, any>;
    const email = (profile.mail || profile.userPrincipalName || '').toLowerCase();
    if (!email) throw new UnauthorizedException('Microsoft email not found');
    return email;
  }

  // ── Resolve user (invite-only) ──────────────────────────

  /**
   * Look up the user by verified email. Login is invite-only: the user must
   * already exist and be active. Throws otherwise. Records a LoginEvent.
   */
  async resolveLoginUser(email: string, provider: OAuthProvider, ctx: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      await this.recordLoginEvent({ email, provider, success: false, ...ctx });
      throw new UnauthorizedException('המשתמש לא קיים במערכת או אינו פעיל. פנה למנהל החברה.');
    }

    await this.recordLoginEvent({ email, provider, success: true, userId: user.id, ...ctx });
    return user;
  }

  async recordLoginEvent(data: {
    email: string;
    provider: string;
    success: boolean;
    userId?: string;
    impersonatedById?: string;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.loginEvent.create({ data });
    } catch (err) {
      this.logger.warn(`Failed to record login event: ${err instanceof Error ? err.message : err}`);
    }
  }
}
