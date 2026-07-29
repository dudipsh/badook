import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        isActive: true,
        language: true,
        createdAt: true,
      },
    });
  }

  async updateLanguage(userId: string, language: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { language },
      select: { id: true, language: true },
    });
  }

  /**
   * Sign a JWT for an authenticated user. Used by the OAuth login flow and
   * by impersonation. `companyId` is null for super admins (no company).
   */
  buildAuthResponse(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string | null;
    language?: string;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        language: user.language,
      },
    };
  }
}
