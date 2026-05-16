import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskPositionDto,
  BulkUpdateTasksDto,
  CreateCommentDto,
  AddTaskDependencyDto,
  TaskFilterDto,
} from './dto/task.dto';
import { paginate, getPaginationParams, PaginationQueryDto } from '../../common/utils/pagination.util';
import { ActivityAction, WsEventType } from '../../common/enums/domain.enum';
import { Prisma } from '@prisma/client';

export const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  position: true,
  estimatedHours: true,
  actualHours: true,
  storyPoints: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  isRecurring: true,
  recurrenceType: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  workflowId: true,
  parentTaskId: true,
  assignee: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
  creator: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
  labels: {
    include: { label: { select: { id: true, name: true, color: true } } },
  },
  _count: {
    select: { subTasks: true, comments: true, attachments: true },
  },
};

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    projectId: string,
    creatorId: string,
    dto: CreateTaskDto,
  ) {
    // Verify project exists
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    // If assignee specified, verify they're a project member
    if (dto.assigneeId) {
      const isMember = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: dto.assigneeId } },
      });
      if (!isMember) throw new BadRequestException('Assignee is not a project member');
    }

    const task = await this.prisma.task.create({
      data: {
        projectId,
        creatorId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        parentTaskId: dto.parentTaskId,
        workflowId: dto.workflowId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        estimatedHours: dto.estimatedHours,
        storyPoints: dto.storyPoints,
        position: dto.position ?? Date.now(),
        labels: dto.labelIds
          ? { create: dto.labelIds.map((labelId) => ({ labelId })) }
          : undefined,
      },
      select: TASK_SELECT,
    });

    // Emit events
    this.eventEmitter.emit('activity.log', {
      organizationId: project.organizationId,
      projectId,
      taskId: task.id,
      actorId: creatorId,
      entity: 'TASK',
      entityId: task.id,
      action: ActivityAction.CREATED,
      after: task,
    });

    this.eventEmitter.emit('ws.broadcast', {
      room: `project:${projectId}`,
      event: WsEventType.TASK_CREATED,
      data: task,
    });

    if (dto.assigneeId && dto.assigneeId !== creatorId) {
      this.eventEmitter.emit('notification.send', {
        recipientId: dto.assigneeId,
        organizationId: project.organizationId,
        type: 'TASK_ASSIGNED',
        title: 'New task assigned',
        message: `You have been assigned to: "${task.title}"`,
        data: { taskId: task.id, projectId },
      });
    }

    return task;
  }

  async findAll(
    projectId: string,
    query: PaginationQueryDto,
    filters: TaskFilterDto,
  ) {
    const { skip, take } = getPaginationParams(query.page, query.limit);

    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
      ...(filters.search && {
        title: { contains: filters.search, mode: 'insensitive' },
      }),
      ...(filters.statuses?.length && { status: { in: filters.statuses as any } }),
      ...(filters.priorities?.length && { priority: { in: filters.priorities as any } }),
      ...(filters.assigneeIds?.length && { assigneeId: { in: filters.assigneeIds } }),
      ...(filters.noAssignee && { assigneeId: null }),
      ...(filters.overdue && {
        dueDate: { lt: new Date() },
        status: { notIn: ['DONE', 'CANCELLED'] as any },
      }),
      ...(filters.dueDateFrom && {
        dueDate: { gte: new Date(filters.dueDateFrom) },
      }),
      ...(filters.dueDateTo && {
        dueDate: { lte: new Date(filters.dueDateTo) },
      }),
      ...(filters.labelIds?.length && {
        labels: { some: { labelId: { in: filters.labelIds } } },
      }),
      parentTaskId: null, // Only top-level tasks (subtasks fetched separately)
    };

    const orderBy: Prisma.TaskOrderByWithRelationInput =
      query.sortBy === 'position'
        ? { position: query.sortOrder || 'asc' }
        : query.sortBy === 'priority'
        ? { priority: query.sortOrder || 'desc' }
        : query.sortBy === 'dueDate'
        ? { dueDate: query.sortOrder || 'asc' }
        : { createdAt: query.sortOrder || 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({ where, select: TASK_SELECT, skip, take, orderBy }),
      this.prisma.task.count({ where }),
    ]);

    return paginate(data, total, query.page || 1, query.limit || 20);
  }

  async findOne(taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        ...TASK_SELECT,
        subTasks: { where: { deletedAt: null }, select: TASK_SELECT },
        blockedBy: {
          include: {
            dependsOn: { select: { id: true, title: true, status: true } },
          },
        },
        blocking: {
          include: {
            task: { select: { id: true, title: true, status: true } },
          },
        },
        timeEntries: {
          select: {
            id: true, description: true, startedAt: true,
            endedAt: true, durationMs: true,
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(taskId: string, actorId: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: { project: { select: { organizationId: true } } },
    });
    if (!existing) throw new NotFoundException('Task not found');

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) {
      data.status = dto.status as any;
      if (dto.status === 'DONE') data.completedAt = new Date();
      if (existing.status === 'DONE' && dto.status !== 'DONE') data.completedAt = null;
    }
    if (dto.priority !== undefined) data.priority = dto.priority as any;
    if (dto.assigneeId !== undefined) data.assignee = dto.assigneeId ? { connect: { id: dto.assigneeId } } : { disconnect: true };
    if (dto.workflowId !== undefined) data.workflow = dto.workflowId ? { connect: { id: dto.workflowId } } : { disconnect: true };
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.estimatedHours !== undefined) data.estimatedHours = dto.estimatedHours;
    if (dto.storyPoints !== undefined) data.storyPoints = dto.storyPoints;
    if (dto.position !== undefined) data.position = dto.position;

    if (dto.labelIds !== undefined) {
      data.labels = {
        deleteMany: {},
        create: dto.labelIds.map((labelId) => ({ labelId })),
      };
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data,
      select: TASK_SELECT,
    });

    // Determine action
    const action = dto.status !== undefined && dto.status !== existing.status
      ? ActivityAction.STATUS_CHANGED
      : dto.assigneeId !== undefined && dto.assigneeId !== existing.assigneeId
      ? ActivityAction.ASSIGNED
      : ActivityAction.UPDATED;

    this.eventEmitter.emit('activity.log', {
      organizationId: existing.project.organizationId,
      projectId: existing.projectId,
      taskId: taskId,
      actorId,
      entity: 'TASK',
      entityId: taskId,
      action,
      before: existing,
      after: updated,
    });

    this.eventEmitter.emit('ws.broadcast', {
      room: `project:${existing.projectId}`,
      event: WsEventType.TASK_UPDATED,
      data: updated,
    });

    return updated;
  }

  async updatePosition(taskId: string, actorId: string, dto: UpdateTaskPositionDto) {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        position: dto.position,
        workflowId: dto.workflowId,
      },
      select: { id: true, position: true, workflowId: true, projectId: true },
    });

    this.eventEmitter.emit('ws.broadcast', {
      room: `project:${task.projectId}`,
      event: WsEventType.TASK_POSITION_CHANGED,
      data: task,
    });

    return task;
  }

  async bulkUpdate(dto: BulkUpdateTasksDto, actorId: string) {
    const updateData: Prisma.TaskUpdateManyMutationInput = {};
    if (dto.status) updateData.status = dto.status as any;
    if (dto.priority) updateData.priority = dto.priority as any;

    if (dto.assigneeId) {
      // Must use individual updates for relation changes
      await Promise.all(
        dto.taskIds.map((id) =>
          this.prisma.task.update({
            where: { id },
            data: { assigneeId: dto.assigneeId },
          }),
        ),
      );
    } else {
      await this.prisma.task.updateMany({
        where: { id: { in: dto.taskIds }, deletedAt: null },
        data: updateData,
      });
    }

    return { updated: dto.taskIds.length };
  }

  async softDelete(taskId: string, actorId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: { project: { select: { organizationId: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');

    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });

    this.eventEmitter.emit('activity.log', {
      organizationId: task.project.organizationId,
      projectId: task.projectId,
      taskId,
      actorId,
      entity: 'TASK',
      entityId: taskId,
      action: ActivityAction.DELETED,
    });

    this.eventEmitter.emit('ws.broadcast', {
      room: `project:${task.projectId}`,
      event: WsEventType.TASK_DELETED,
      data: { id: taskId },
    });

    return { deleted: true };
  }

  // ─── Comments ───────────────────────────────────────────────────────────────

  async addComment(taskId: string, authorId: string, dto: CreateCommentDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: { project: { select: { organizationId: true, id: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');

    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        authorId,
        content: dto.content,
        parentId: dto.parentId,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    this.eventEmitter.emit('ws.broadcast', {
      room: `task:${taskId}`,
      event: WsEventType.COMMENT_CREATED,
      data: comment,
    });

    this.eventEmitter.emit('activity.log', {
      organizationId: task.project.organizationId,
      projectId: task.projectId,
      taskId,
      actorId: authorId,
      entity: 'COMMENT',
      entityId: comment.id,
      action: ActivityAction.COMMENTED,
      after: { content: dto.content },
    });

    return comment;
  }

  async getComments(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId, parentId: null, deletedAt: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        replies: {
          where: { deletedAt: null },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Dependencies ────────────────────────────────────────────────────────────

  async addDependency(taskId: string, dto: AddTaskDependencyDto) {
    if (taskId === dto.dependsOnId) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    return this.prisma.taskDependency.create({
      data: {
        taskId,
        dependsOnId: dto.dependsOnId,
        dependencyType: dto.dependencyType as any || 'BLOCKS',
      },
    });
  }

  async removeDependency(taskId: string, dependsOnId: string) {
    await this.prisma.taskDependency.deleteMany({
      where: { taskId, dependsOnId },
    });
    return { removed: true };
  }

  // ─── Kanban ───────────────────────────────────────────────────────────────────

  async getKanbanBoard(projectId: string) {
    const workflows = await this.prisma.workflow.findMany({
      where: { projectId },
      include: {
        tasks: {
          where: { deletedAt: null, parentTaskId: null },
          select: TASK_SELECT,
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { position: 'asc' },
    });

    return workflows;
  }

  // ─── Activity ────────────────────────────────────────────────────────────────

  async getTaskActivity(taskId: string) {
    return this.prisma.activity.findMany({
      where: { taskId },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
