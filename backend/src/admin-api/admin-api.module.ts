import { Module } from '@nestjs/common'
import { AdminApiController } from './admin-api.controller'
import { AdminApiService } from './admin-api.service'

@Module({
  controllers: [AdminApiController],
  providers: [AdminApiService],
})
export class AdminApiModule {}
