import { Module } from '@nestjs/common'
import { InternalController } from './internal.controller'
import { InternalService } from './internal.service'
import { InternalApiKeyGuard } from './guards/internal-api-key.guard'

@Module({
  controllers: [InternalController],
  providers: [InternalService, InternalApiKeyGuard],
})
export class InternalModule {}
