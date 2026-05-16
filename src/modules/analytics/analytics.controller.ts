import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Get comprehensive project metrics and charts data' })
  async getProjectMetrics(@Param('projectId') projectId: string) {
    return this.analyticsService.getProjectMetrics(projectId);
  }

  @Get('organizations/:orgId')
  @ApiOperation({ summary: 'Get organization-level analytics' })
  async getOrgMetrics(@Param('orgId') orgId: string) {
    return this.analyticsService.getOrganizationMetrics(orgId);
  }

  @Get('me/productivity')
  @ApiOperation({ summary: 'Get current user productivity metrics' })
  async getMyProductivity(
    @CurrentUser('id') userId: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getMemberProductivity(userId, parseInt(days || '30', 10));
  }

  @Get('projects/:projectId/velocity')
  @ApiOperation({ summary: 'Get sprint velocity chart data' })
  async getVelocity(
    @Param('projectId') projectId: string,
    @Query('weeks') weeks?: string,
  ) {
    return this.analyticsService.getVelocityMetrics(projectId, parseInt(weeks || '4', 10));
  }
}
