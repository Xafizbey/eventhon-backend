import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto, UpdateProjectDto, AddProjectMemberDto, CreateWorkflowDto, CreateLabelDto,
} from './dto/project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations/:orgId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project in organization' })
  async create(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(orgId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects in organization' })
  async findAll(
    @Param('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.projectsService.findAll(orgId, parseInt(page || '1', 10), parseInt(limit || '20', 10));
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details with members, workflows, and labels' })
  async findOne(@Param('projectId') projectId: string) {
    return this.projectsService.findOne(projectId);
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update project' })
  async update(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(projectId, userId, dto);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive and soft-delete a project' })
  async remove(@Param('projectId') projectId: string) {
    return this.projectsService.softDelete(projectId);
  }

  @Post(':projectId/members')
  @ApiOperation({ summary: 'Add member to project' })
  async addMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(projectId, dto);
  }

  @Delete(':projectId/members/:userId')
  @ApiOperation({ summary: 'Remove member from project' })
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.projectsService.removeMember(projectId, userId);
  }

  @Post(':projectId/workflows')
  @ApiOperation({ summary: 'Create a custom workflow/column for project' })
  async createWorkflow(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.projectsService.createWorkflow(projectId, dto);
  }

  @Post(':projectId/labels')
  @ApiOperation({ summary: 'Create a label for project' })
  async createLabel(
    @Param('projectId') projectId: string,
    @Body() dto: CreateLabelDto,
  ) {
    return this.projectsService.createLabel(projectId, dto);
  }

  @Get(':projectId/activity')
  @ApiOperation({ summary: 'Get project activity history' })
  async getActivity(@Param('projectId') projectId: string) {
    return this.projectsService.getProjectActivity(projectId);
  }
}

@ApiTags('Projects (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class AdminProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all projects across all organizations (Super Admin only)' })
  async getAllProjects() {
    return this.projectsService.getAllAdmin();
  }
}
