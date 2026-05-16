import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CreateProjectDto, UpdateProjectDto, AddProjectMemberDto, CreateWorkflowDto, CreateLabelDto,
} from './dto/project.dto';
import { paginate, getPaginationParams } from '../../common/utils/pagination.util';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(organizationId: string, ownerId: string, dto: CreateProjectDto) {
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 50);

    const project = await this.prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          organizationId,
          ownerId,
          name: dto.name,
          description: dto.description,
          slug,
          icon: dto.icon,
          color: dto.color,
          visibility: dto.visibility as any || 'PRIVATE',
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          status: 'PLANNING',
        },
      });

      // Auto-add owner as project manager
      await tx.projectMember.create({
        data: { projectId: proj.id, userId: ownerId, role: 'MANAGER' },
      });

      // Create default workflows
      await tx.workflow.createMany({
        data: [
          { projectId: proj.id, name: 'Backlog', color: '#6b7280', position: 0 },
          { projectId: proj.id, name: 'In Progress', color: '#3b82f6', position: 1, isDefault: true },
          { projectId: proj.id, name: 'In Review', color: '#f59e0b', position: 2 },
          { projectId: proj.id, name: 'Done', color: '#10b981', position: 3 },
        ],
      });

      // Create default labels
      await tx.label.createMany({
        data: [
          { projectId: proj.id, name: 'Bug', color: '#ef4444' },
          { projectId: proj.id, name: 'Feature', color: '#3b82f6' },
          { projectId: proj.id, name: 'Improvement', color: '#8b5cf6' },
          { projectId: proj.id, name: 'Documentation', color: '#6b7280' },
        ],
      });

      return proj;
    });

    this.eventEmitter.emit('activity.log', {
      organizationId,
      projectId: project.id,
      actorId: ownerId,
      entity: 'PROJECT',
      entityId: project.id,
      action: 'CREATED',
      after: project,
    });

    return project;
  }

  async findAll(organizationId: string, page = 1, limit = 20) {
    const { skip, take } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          _count: { select: { tasks: true, members: true } },
        },
        skip, take,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.project.count({ where: { organizationId, deletedAt: null } }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
          },
        },
        workflows: { orderBy: { position: 'asc' } },
        labels: { orderBy: { position: 'asc' } },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(projectId: string, actorId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...dto,
        status: dto.status as any,
        visibility: dto.visibility as any,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    this.eventEmitter.emit('ws.broadcast', {
      room: `project:${projectId}`,
      event: 'project:updated',
      data: project,
    });

    return project;
  }

  async softDelete(projectId: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date(), status: 'ARCHIVED' as any },
    });
  }

  async addMember(projectId: string, dto: AddProjectMemberDto) {
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('User is already a project member');

    return this.prisma.projectMember.create({
      data: { projectId, userId: dto.userId, role: dto.role as any || 'MEMBER' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async removeMember(projectId: string, userId: string) {
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
    return { removed: true };
  }

  async createWorkflow(projectId: string, dto: CreateWorkflowDto) {
    const lastWorkflow = await this.prisma.workflow.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.workflow.create({
      data: {
        projectId,
        name: dto.name,
        color: dto.color,
        description: dto.description,
        position: (lastWorkflow?.position || 0) + 1,
      },
    });
  }

  async createLabel(projectId: string, dto: CreateLabelDto) {
    return this.prisma.label.create({
      data: { projectId, name: dto.name, color: dto.color },
    });
  }

  async getProjectActivity(projectId: string) {
    return this.prisma.activity.findMany({
      where: { projectId },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
