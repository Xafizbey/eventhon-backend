import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { WsEventType } from '../../common/enums/domain.enum';

export interface AssigneeRecommendation {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  confidence: number;
  reason: string;
  workloadScore: number;
}

export interface CompletionTimeEstimate {
  estimatedHours: number;
  estimatedDueDate: Date;
  confidence: number;
  factors: string[];
}

export interface DeadlineRiskAnalysis {
  isAtRisk: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  reasons: string[];
  recommendations: string[];
}

export interface WorkloadAnalysis {
  userId: string;
  totalTasks: number;
  overdueTasks: number;
  upcomingDeadlines: number;
  estimatedHoursRemaining: number;
  overloadScore: number;
  isOverloaded: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private httpService: HttpService,
  ) {}

  /**
   * Recommend best assignee for a task based on:
   * - Current workload
   * - Past task completion history
   * - Skills match (via task labels/metadata)
   * - Availability
   */
  async recommendAssignee(
    taskId: string,
    projectId: string,
    requestedById: string,
  ): Promise<AssigneeRecommendation[]> {
    const orgId = await this.getOrgId(projectId);

    // Create prediction record
    const prediction = await this.prisma.aIPrediction.create({
      data: {
        organizationId: orgId,
        projectId,
        taskId,
        requestedById,
        type: 'ASSIGNEE_RECOMMENDATION',
        status: 'PROCESSING',
        input: { taskId, projectId },
      },
    });

    try {
      const [task, projectMembers] = await Promise.all([
        this.prisma.task.findUnique({
          where: { id: taskId },
          include: { labels: { include: { label: true } } },
        }),
        this.prisma.projectMember.findMany({
          where: { projectId },
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, avatarUrl: true,
                assignedTasks: {
                  where: {
                    status: { notIn: ['DONE', 'CANCELLED'] },
                    deletedAt: null,
                  },
                  select: { id: true, priority: true, dueDate: true, estimatedHours: true },
                },
              },
            },
          },
        }),
      ]);

      let recommendations: AssigneeRecommendation[] = [];

      // Try AI microservice first
      if (this.configService.get<boolean>('ai.enabled') && this.configService.get<string>('ai.serviceUrl')) {
        try {
          const response = await firstValueFrom<any>(
            this.httpService.post(
              `${this.configService.get('ai.serviceUrl')}/predict/assignee`,
              {
                task: {
                  id: task?.id,
                  title: task?.title,
                  priority: task?.priority,
                  labels: task?.labels.map((l) => l.label.name),
                  estimatedHours: task?.estimatedHours,
                },
                candidates: projectMembers.map((m) => ({
                  userId: m.userId,
                  activeTasks: m.user.assignedTasks.length,
                  estimatedHoursRemaining: m.user.assignedTasks.reduce(
                    (sum, t) => sum + (t.estimatedHours || 2),
                    0,
                  ),
                })),
              },
              {
                headers: { 'X-API-Key': this.configService.get('ai.apiKey') },
                timeout: this.configService.get<number>('ai.timeoutMs'),
              },
            ),
          );
          recommendations = response.data.recommendations;
        } catch (err) {
          this.logger.warn('AI service unavailable, using fallback algorithm');
          recommendations = this.fallbackAssigneeRecommendation(projectMembers);
        }
      } else {
        recommendations = this.fallbackAssigneeRecommendation(projectMembers);
      }

      await this.prisma.aIPrediction.update({
        where: { id: prediction.id },
        data: {
          status: 'COMPLETED',
          output: recommendations as any,
          confidence: recommendations[0]?.confidence || 0,
        },
      });

      // Notify via WebSocket
      this.eventEmitter.emit('ws.send.user', {
        userId: requestedById,
        event: WsEventType.AI_PREDICTION_READY,
        data: { predictionId: prediction.id, type: 'ASSIGNEE_RECOMMENDATION', recommendations },
      });

      return recommendations;
    } catch (error) {
      await this.prisma.aIPrediction.update({
        where: { id: prediction.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      throw error;
    }
  }

  /**
   * Estimate task completion time based on:
   * - Historical data for similar tasks
   * - Task complexity (labels, subtask count, description length)
   * - Team velocity
   */
  async estimateCompletionTime(
    taskId: string,
    requestedById: string,
  ): Promise<CompletionTimeEstimate> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { organizationId: true } },
        labels: { include: { label: true } },
        _count: { select: { subTasks: true } },
      },
    });

    if (!task) throw new Error('Task not found');

    const orgId = task.project.organizationId;

    // Get historical completion data for similar tasks
    const historicalTasks = await this.prisma.task.findMany({
      where: {
        projectId: task.projectId,
        status: 'DONE',
        completedAt: { not: null },
        actualHours: { not: null },
        deletedAt: null,
      },
      select: {
        estimatedHours: true,
        actualHours: true,
        priority: true,
        storyPoints: true,
      },
      take: 50,
      orderBy: { completedAt: 'desc' },
    });

    // Simple regression-based estimation fallback
    const avgActualHours =
      historicalTasks.length > 0
        ? historicalTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0) / historicalTasks.length
        : 4;

    const priorityMultiplier: Record<string, number> = {
      URGENT: 0.7, HIGH: 0.85, MEDIUM: 1.0, LOW: 1.2, NO_PRIORITY: 1.0,
    };

    const estimatedHours =
      (task.estimatedHours || avgActualHours) * (priorityMultiplier[task.priority] || 1.0);

    const estimatedDueDate = new Date();
    estimatedDueDate.setHours(estimatedDueDate.getHours() + estimatedHours * 8);

    return {
      estimatedHours,
      estimatedDueDate,
      confidence: historicalTasks.length > 10 ? 0.8 : 0.5,
      factors: [
        `Based on ${historicalTasks.length} historical tasks`,
        `Priority: ${task.priority}`,
        `Subtasks: ${task._count.subTasks}`,
      ],
    };
  }

  /**
   * Detect deadline risks across a project
   */
  async detectDeadlineRisks(projectId: string): Promise<DeadlineRiskAnalysis[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        dueDate: { not: null },
        deletedAt: null,
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { subTasks: true } },
      },
    });

    const now = new Date();

    return tasks.map((task) => {
      const hoursUntilDue = task.dueDate
        ? (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        : Infinity;

      const isOverdue = hoursUntilDue < 0;
      const isDueSoon = hoursUntilDue < 24;
      const isDueThisWeek = hoursUntilDue < 168;
      const hasSubtasks = task._count.subTasks > 0;
      const isHighPriority = ['URGENT', 'HIGH'].includes(task.priority);

      let riskScore = 0;
      const reasons: string[] = [];
      const recommendations: string[] = [];

      if (isOverdue) { riskScore += 100; reasons.push('Task is overdue'); }
      else if (isDueSoon) { riskScore += 70; reasons.push('Due in less than 24 hours'); }
      else if (isDueThisWeek) { riskScore += 40; reasons.push('Due this week'); }

      if (isHighPriority) { riskScore += 20; }
      if (!task.assigneeId) { riskScore += 30; reasons.push('No assignee assigned'); recommendations.push('Assign this task immediately'); }
      if (task.status === 'BACKLOG') { riskScore += 25; reasons.push('Task still in backlog'); }
      if (hasSubtasks) { riskScore += 10; reasons.push('Has unfinished subtasks'); }

      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (riskScore >= 80) riskLevel = 'CRITICAL';
      else if (riskScore >= 50) riskLevel = 'HIGH';
      else if (riskScore >= 30) riskLevel = 'MEDIUM';
      else riskLevel = 'LOW';

      if (!task.assigneeId) recommendations.push('Assign this task to a team member');
      if (task.status === 'BACKLOG') recommendations.push('Move task to TODO or IN_PROGRESS');

      return {
        isAtRisk: riskScore >= 30,
        riskLevel,
        riskScore: Math.min(riskScore, 100),
        reasons,
        recommendations,
      };
    });
  }

  /**
   * Analyze workload for team members
   */
  async analyzeWorkload(organizationId: string, projectId?: string): Promise<WorkloadAnalysis[]> {
    const memberWhere: any = projectId
      ? { projectId }
      : { project: { organizationId } };

    const members = await this.prisma.projectMember.findMany({
      where: memberWhere,
      distinct: ['userId'],
      include: {
        user: {
          include: {
            assignedTasks: {
              where: {
                status: { notIn: ['DONE', 'CANCELLED'] },
                deletedAt: null,
                ...(projectId && { projectId }),
              },
              select: {
                id: true,
                priority: true,
                dueDate: true,
                estimatedHours: true,
                status: true,
              },
            },
          },
        },
      },
    });

    const now = new Date();

    return members.map((m) => {
      const tasks = m.user.assignedTasks;
      const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < now).length;
      const upcomingDeadlines = tasks.filter((t) => {
        if (!t.dueDate) return false;
        const diff = (t.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 3;
      }).length;

      const estimatedHoursRemaining = tasks.reduce(
        (sum, t) => sum + (t.estimatedHours || 2),
        0,
      );

      // Overload score: 0-100
      const overloadScore = Math.min(
        ((tasks.length / 10) * 40) +
        ((overdueTasks / Math.max(tasks.length, 1)) * 40) +
        ((estimatedHoursRemaining / 40) * 20),
        100,
      );

      return {
        userId: m.userId,
        totalTasks: tasks.length,
        overdueTasks,
        upcomingDeadlines,
        estimatedHoursRemaining,
        overloadScore,
        isOverloaded: overloadScore >= 70,
      };
    });
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private fallbackAssigneeRecommendation(projectMembers: any[]): AssigneeRecommendation[] {
    return projectMembers
      .map((m) => {
        const activeTasks = m.user.assignedTasks?.length || 0;
        const workloadScore = Math.min(activeTasks / 10, 1);
        const confidence = Math.max(0.3, 1 - workloadScore);

        return {
          userId: m.userId,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          avatarUrl: m.user.avatarUrl,
          confidence,
          reason: activeTasks === 0 ? 'No active tasks' : `${activeTasks} active tasks`,
          workloadScore,
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  private async getOrgId(projectId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new Error('Project not found');
    return project.organizationId;
  }
}
