import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto, UpdateTaskDto, UpdateTaskPositionDto,
  BulkUpdateTasksDto, CreateCommentDto, AddTaskDependencyDto, TaskFilterDto,
} from './dto/task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/utils/pagination.util';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task in project' })
  async create(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks in project with filtering & pagination' })
  async findAll(
    @Param('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
    @Query() filters: TaskFilterDto,
  ) {
    return this.tasksService.findAll(projectId, query, filters);
  }

  @Get('kanban')
  @ApiOperation({ summary: 'Get tasks organized for Kanban board view' })
  async getKanban(@Param('projectId') projectId: string) {
    return this.tasksService.getKanbanBoard(projectId);
  }

  @Patch('bulk')
  @ApiOperation({ summary: 'Bulk update multiple tasks' })
  async bulkUpdate(
    @Body() dto: BulkUpdateTasksDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.bulkUpdate(dto, userId);
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Get single task with full details' })
  async findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }

  @Patch(':taskId')
  @ApiOperation({ summary: 'Update task fields' })
  async update(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(taskId, userId, dto);
  }

  @Patch(':taskId/position')
  @ApiOperation({ summary: 'Update task position (for drag-and-drop Kanban)' })
  async updatePosition(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTaskPositionDto,
  ) {
    return this.tasksService.updatePosition(taskId, userId, dto);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a task' })
  async remove(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.softDelete(taskId, userId);
  }

  // ─── Comments ────────────────────────────────────────────────────────────────

  @Get(':taskId/comments')
  @ApiOperation({ summary: 'Get task comments with replies' })
  async getComments(@Param('taskId') taskId: string) {
    return this.tasksService.getComments(taskId);
  }

  @Post(':taskId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a task' })
  async addComment(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tasksService.addComment(taskId, userId, dto);
  }

  // ─── Activity ────────────────────────────────────────────────────────────────

  @Get(':taskId/activity')
  @ApiOperation({ summary: 'Get task activity timeline' })
  async getActivity(@Param('taskId') taskId: string) {
    return this.tasksService.getTaskActivity(taskId);
  }

  // ─── Dependencies ────────────────────────────────────────────────────────────

  @Post(':taskId/dependencies')
  @ApiOperation({ summary: 'Add task dependency' })
  async addDependency(
    @Param('taskId') taskId: string,
    @Body() dto: AddTaskDependencyDto,
  ) {
    return this.tasksService.addDependency(taskId, dto);
  }

  @Delete(':taskId/dependencies/:dependsOnId')
  @ApiOperation({ summary: 'Remove task dependency' })
  async removeDependency(
    @Param('taskId') taskId: string,
    @Param('dependsOnId') dependsOnId: string,
  ) {
    return this.tasksService.removeDependency(taskId, dependsOnId);
  }
}
