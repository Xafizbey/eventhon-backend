export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_OWNER = 'ORG_OWNER',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  TEAM_MEMBER = 'TEAM_MEMBER',
  VIEWER = 'VIEWER',
}

export enum MemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum Permission {
  // Organization
  ORG_CREATE = 'org:create',
  ORG_READ = 'org:read',
  ORG_UPDATE = 'org:update',
  ORG_DELETE = 'org:delete',
  ORG_MANAGE_MEMBERS = 'org:manage_members',
  ORG_MANAGE_BILLING = 'org:manage_billing',
  ORG_VIEW_ANALYTICS = 'org:view_analytics',

  // Projects
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  PROJECT_MANAGE_MEMBERS = 'project:manage_members',
  PROJECT_VIEW_REPORTS = 'project:view_reports',

  // Tasks
  TASK_CREATE = 'task:create',
  TASK_READ = 'task:read',
  TASK_UPDATE = 'task:update',
  TASK_DELETE = 'task:delete',
  TASK_ASSIGN = 'task:assign',
  TASK_COMMENT = 'task:comment',
  TASK_UPLOAD = 'task:upload',

  // AI
  AI_REQUEST = 'ai:request',
  AI_VIEW_PREDICTIONS = 'ai:view_predictions',

  // Admin
  ADMIN_FULL_ACCESS = 'admin:full_access',
  ADMIN_VIEW_LOGS = 'admin:view_logs',
  ADMIN_MANAGE_USERS = 'admin:manage_users',
}

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  [MemberRole.OWNER]: Object.values(Permission),
  [MemberRole.ADMIN]: [
    Permission.ORG_READ,
    Permission.ORG_UPDATE,
    Permission.ORG_MANAGE_MEMBERS,
    Permission.ORG_VIEW_ANALYTICS,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.PROJECT_MANAGE_MEMBERS,
    Permission.PROJECT_VIEW_REPORTS,
    Permission.TASK_CREATE,
    Permission.TASK_READ,
    Permission.TASK_UPDATE,
    Permission.TASK_DELETE,
    Permission.TASK_ASSIGN,
    Permission.TASK_COMMENT,
    Permission.TASK_UPLOAD,
    Permission.AI_REQUEST,
    Permission.AI_VIEW_PREDICTIONS,
  ],
  [MemberRole.MANAGER]: [
    Permission.ORG_READ,
    Permission.ORG_VIEW_ANALYTICS,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_MANAGE_MEMBERS,
    Permission.PROJECT_VIEW_REPORTS,
    Permission.TASK_CREATE,
    Permission.TASK_READ,
    Permission.TASK_UPDATE,
    Permission.TASK_DELETE,
    Permission.TASK_ASSIGN,
    Permission.TASK_COMMENT,
    Permission.TASK_UPLOAD,
    Permission.AI_REQUEST,
    Permission.AI_VIEW_PREDICTIONS,
  ],
  [MemberRole.MEMBER]: [
    Permission.ORG_READ,
    Permission.PROJECT_READ,
    Permission.TASK_CREATE,
    Permission.TASK_READ,
    Permission.TASK_UPDATE,
    Permission.TASK_COMMENT,
    Permission.TASK_UPLOAD,
  ],
  [MemberRole.VIEWER]: [
    Permission.ORG_READ,
    Permission.PROJECT_READ,
    Permission.TASK_READ,
  ],
};
