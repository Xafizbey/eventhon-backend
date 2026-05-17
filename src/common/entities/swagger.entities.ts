import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus, OrgStatus, OrgPlan, OrganizationType, MemberRole, ProjectStatus, ProjectVisibility, TaskStatus, TaskPriority } from '@prisma/client';

export class UserEntity {
  @ApiProperty({ example: 'usr_123456789' })
  id: string;

  @ApiProperty({ example: 'hafizfullstack@gmail.com' })
  email: string;

  @ApiProperty({ example: 'Hafiz' })
  firstName: string;

  @ApiProperty({ example: 'Joldosh' })
  lastName: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png', nullable: true })
  avatarUrl: string | null;

  @ApiPropertyOptional({ example: 'Software engineer bio', nullable: true })
  bio: string | null;

  @ApiProperty({ example: 'UTC' })
  timezone: string;

  @ApiProperty({ example: 'en' })
  locale: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SUPER_ADMIN })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiPropertyOptional({ example: '2026-05-17T08:05:21.836Z', nullable: true })
  lastActiveAt: Date | null;

  @ApiProperty({ example: '2026-05-17T08:05:21.836Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-17T08:05:21.836Z' })
  updatedAt: Date;
}

export class OrganizationEntity {
  @ApiProperty({ example: 'org_123456789' })
  id: string;

  @ApiProperty({ example: 'Acme Corp' })
  name: string;

  @ApiProperty({ example: 'acme-corp' })
  slug: string;

  @ApiPropertyOptional({ example: 'A software company', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ example: 'https://acme.com/logo.png', nullable: true })
  logoUrl: string | null;

  @ApiPropertyOptional({ example: 'https://acme.com', nullable: true })
  website: string | null;

  @ApiProperty({ enum: OrgPlan, example: OrgPlan.FREE })
  plan: OrgPlan;

  @ApiProperty({ enum: OrgStatus, example: OrgStatus.ACTIVE })
  status: OrgStatus;

  @ApiProperty({ enum: OrganizationType, example: OrganizationType.IT_COMPANY })
  type: OrganizationType;

  @ApiProperty({ example: '2026-05-17T08:05:21.836Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-17T08:05:21.836Z' })
  updatedAt: Date;
}

export class SessionEntity {
  @ApiProperty({ example: 'sess_123456789' })
  id: string;

  @ApiProperty({ example: 'usr_123456789' })
  userId: string;

  @ApiProperty({ example: '{}' })
  deviceInfo: any;

  @ApiPropertyOptional({ example: '127.0.0.1', nullable: true })
  ipAddress: string | null;

  @ApiPropertyOptional({ example: 'Mozilla/5.0...', nullable: true })
  userAgent: string | null;

  @ApiProperty({ example: true })
  isValid: boolean;

  @ApiProperty({ example: '2026-05-24T08:05:21.836Z' })
  expiresAt: Date;

  @ApiProperty({ example: '2026-05-17T08:05:21.836Z' })
  createdAt: Date;
}

export class ProjectEntity {
  @ApiProperty({ example: 'proj_123456789' })
  id: string;

  @ApiProperty({ example: 'org_123456789' })
  organizationId: string;

  @ApiProperty({ example: 'usr_123456789' })
  ownerId: string;

  @ApiProperty({ example: 'Hackathon 2026' })
  name: string;

  @ApiPropertyOptional({ example: 'Annual event', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'hackathon-2026' })
  slug: string;

  @ApiPropertyOptional({ example: 'trophy', nullable: true })
  icon: string | null;

  @ApiPropertyOptional({ example: '#6366F1', nullable: true })
  color: string | null;

  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.ACTIVE })
  status: ProjectStatus;

  @ApiProperty({ enum: ProjectVisibility, example: ProjectVisibility.PUBLIC })
  visibility: ProjectVisibility;

  @ApiPropertyOptional({ example: '2026-05-17T08:05:21.836Z', nullable: true })
  startDate: Date | null;

  @ApiPropertyOptional({ example: '2026-05-24T08:05:21.836Z', nullable: true })
  dueDate: Date | null;

  @ApiProperty({ example: '2026-05-17T08:05:21.836Z' })
  createdAt: Date;
}

export class TaskEntity {
  @ApiProperty({ example: 'task_123456789' })
  id: string;

  @ApiProperty({ example: 'proj_123456789' })
  projectId: string;

  @ApiPropertyOptional({ example: 'wf_123', nullable: true })
  workflowId: string | null;

  @ApiPropertyOptional({ example: 'usr_123', nullable: true })
  assigneeId: string | null;

  @ApiProperty({ example: 'usr_456' })
  creatorId: string;

  @ApiProperty({ example: 'Design Homepage UI' })
  title: string;

  @ApiPropertyOptional({ example: 'Detailed descriptions...', nullable: true })
  description: string | null;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.IN_PROGRESS })
  status: TaskStatus;

  @ApiProperty({ enum: TaskPriority, example: TaskPriority.HIGH })
  priority: TaskPriority;

  @ApiPropertyOptional({ example: 4.5, nullable: true })
  estimatedHours: number | null;

  @ApiPropertyOptional({ example: '2026-05-24T08:05:21.836Z', nullable: true })
  dueDate: Date | null;

  @ApiProperty({ example: '2026-05-17T08:05:21.836Z' })
  createdAt: Date;
}
