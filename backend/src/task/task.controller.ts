import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiBearerAuth()
@ApiTags('Tasks')
@Throttle({ default: { ttl: 60000, limit: 60 } })
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.create(orgId, user.sub, dto);
  }

  @Get('my')
  findMy(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryTaskDto,
  ) {
    return this.taskService.findMy(orgId, user.sub, query.status);
  }

  @Get()
  findAll(@OrgId() orgId: string, @Query() query: QueryTaskDto) {
    return this.taskService.findAll(
      orgId,
      query.status,
      query.priority,
      query.assignedToId,
    );
  }

  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(orgId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.taskService.remove(orgId, user.sub, id);
  }
}
