import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new ForbiddenException('Missing token');
    const payload = await this.jwt.verifyAsync(token, { secret: this.config.get('jwt.secret') });
    if (payload?.role !== 'SUPER_ADMIN') throw new ForbiddenException('Super admin access required');
    return true;
  }
}
