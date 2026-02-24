import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const key = request.headers['x-internal-api-key']
    const expected = this.config.getOrThrow<string>('INTERNAL_API_KEY')

    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key')
    }

    return true
  }
}
