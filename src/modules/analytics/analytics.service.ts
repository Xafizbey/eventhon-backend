import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getProjectMetrics(projectId: string) {
    const [tasksByStatus, tasksByPriority, tasksByAssignee, overdueTasks, completionTrend] =
      await Promise.all([
        // Tasks grouped by status
        this.prisma.task.groupBy({
          by: ['status'],
          where: { projectId, deletedAt: null },
          _count: { _all: true },
        }),
        // Tasks grouped by priority
        this.prisma.task.groupBy({
          by: ['priority'],
          where: { projectId, deletedAt: null },
          _count: { _all: true },
        }),
        // Tasks per assignee
        this.prisma.task.groupBy({
          by: ['assigneeId'],
          where: { projectId, deletedAt: null, assigneeId: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { assigneeId: 'desc' } },
          take: 10,
        }),
        // Overdue count
        this.prisma.task.count({
          where: {
            projectId,
            deletedAt: null,
            dueDate: { lt: new Date() },
            status: { notIn: ['DONE', 'CANCELLED'] },
          },
        }),
        // Completion trend (last 30 days)
        this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
          SELECT DATE(completed_at) as date, COUNT(*) as count
          FROM tasks
          WHERE project_id = ${projectId}
            AND completed_at IS NOT NULL
            AND completed_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(completed_at)
          ORDER BY date ASC
        `,
      ]);

    const totalTasks = tasksByStatus.reduce((sum, g) => sum + g._count._all, 0);
    const completedTasks = tasksByStatus.find((g) => g.status === 'DONE')?._count._all || 0;

    return {
      summary: {
        totalTasks,
        completedTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      tasksByStatus,
      tasksByPriority,
      tasksByAssignee,
      completionTrend: completionTrend.map((t) => ({
        date: t.date,
        count: Number(t.count),
      })),
    };
  }

  async getOrganizationMetrics(organizationId: string) {
    const [projectCount, activeProjects, memberCount, totalTasks, completedThisMonth] =
      await Promise.all([
        this.prisma.project.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.project.count({
          where: { organizationId, status: 'ACTIVE', deletedAt: null },
        }),
        this.prisma.organizationMember.count({ where: { organizationId } }),
        this.prisma.task.count({
          where: { project: { organizationId }, deletedAt: null },
        }),
        this.prisma.task.count({
          where: {
            project: { organizationId },
            status: 'DONE',
            completedAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
      ]);

    return {
      projects: { total: projectCount, active: activeProjects },
      members: { total: memberCount },
      tasks: {
        total: totalTasks,
        completedThisMonth,
      },
    };
  }

  async getMemberProductivity(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [completed, created, commented] = await Promise.all([
      this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: 'DONE',
          completedAt: { gte: since },
        },
      }),
      this.prisma.task.count({
        where: { creatorId: userId, createdAt: { gte: since } },
      }),
      this.prisma.comment.count({
        where: { authorId: userId, createdAt: { gte: since } },
      }),
    ]);

    return { completed, created, commented, period: `${days}d` };
  }

  async getVelocityMetrics(projectId: string, weeks = 4) {
    const results = [];
    const now = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i + 1) * 7);
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);

      const [completed, storyPoints] = await Promise.all([
        this.prisma.task.count({
          where: {
            projectId,
            status: 'DONE',
            completedAt: { gte: weekStart, lt: weekEnd },
            deletedAt: null,
          },
        }),
        this.prisma.task.aggregate({
          where: {
            projectId,
            status: 'DONE',
            completedAt: { gte: weekStart, lt: weekEnd },
            deletedAt: null,
            storyPoints: { not: null },
          },
          _sum: { storyPoints: true },
        }),
      ]);

      results.push({
        weekStart,
        weekEnd,
        completedTasks: completed,
        storyPoints: storyPoints._sum.storyPoints || 0,
      });
    }

    return results;
  }
}
