import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('tasks/:taskId/recommend-assignee')
  @ApiOperation({
    summary: 'Get AI-powered assignee recommendations for a task',
    description: 'Returns top 3 team members ranked by availability and past performance',
  })
  async recommendAssignee(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
  ) {
    const task = await this.aiService['prisma'].task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    return this.aiService.recommendAssignee(taskId, task!.projectId, userId);
  }

  @Post('tasks/:taskId/estimate-completion')
  @ApiOperation({
    summary: 'Estimate task completion time using historical data',
  })
  async estimateCompletion(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.aiService.estimateCompletionTime(taskId, userId);
  }

  @Get('projects/:projectId/deadline-risks')
  @ApiOperation({
    summary: 'Detect deadline risks for all tasks in a project',
  })
  async detectRisks(@Param('projectId') projectId: string) {
    return this.aiService.detectDeadlineRisks(projectId);
  }

  @Get('organizations/:orgId/workload')
  @ApiOperation({
    summary: 'Analyze team workload and detect overloaded members',
  })
  async analyzeWorkload(
    @Param('orgId') orgId: string,
  ) {
    return this.aiService.analyzeWorkload(orgId);
  }

  @Get('projects/:projectId/workload')
  @ApiOperation({ summary: 'Analyze project-specific team workload' })
  async analyzeProjectWorkload(@Param('projectId') projectId: string) {
    const project = await this.aiService['prisma'].project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    return this.aiService.analyzeWorkload(project!.organizationId, projectId);
  }
}
