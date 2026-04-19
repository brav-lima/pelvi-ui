import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('version')
export class VersionController {
  @Public()
  @Get()
  get() {
    return {
      version: process.env.APP_VERSION ?? 'dev',
      gitSha: process.env.GIT_SHA ?? 'unknown',
      builtAt: process.env.BUILT_AT ?? 'unknown',
    };
  }
}
