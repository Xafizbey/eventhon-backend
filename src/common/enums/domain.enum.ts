export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  NO_PRIORITY = 'NO_PRIORITY',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
  CANCELLED = 'CANCELLED',
}

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_OVERDUE = 'TASK_OVERDUE',
  TASK_COMMENT = 'TASK_COMMENT',
  TASK_MENTIONED = 'TASK_MENTIONED',
  PROJECT_INVITED = 'PROJECT_INVITED',
  PROJECT_UPDATED = 'PROJECT_UPDATED',
  AI_WARNING = 'AI_WARNING',
  AI_RECOMMENDATION = 'AI_RECOMMENDATION',
  SYSTEM = 'SYSTEM',
}

export enum ActivityAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  PRIORITY_CHANGED = 'PRIORITY_CHANGED',
  COMMENTED = 'COMMENTED',
  MENTIONED = 'MENTIONED',
  ATTACHED = 'ATTACHED',
  LOGGED_IN = 'LOGGED_IN',
  LOGGED_OUT = 'LOGGED_OUT',
  INVITED = 'INVITED',
  JOINED = 'JOINED',
  LEFT = 'LEFT',
  ARCHIVED = 'ARCHIVED',
  RESTORED = 'RESTORED',
  AI_ANALYZED = 'AI_ANALYZED',
}

export enum WsEventType {
  // Task events
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_DELETED = 'task:deleted',
  TASK_STATUS_CHANGED = 'task:status_changed',
  TASK_ASSIGNED = 'task:assigned',
  TASK_POSITION_CHANGED = 'task:position_changed',

  // Comment events
  COMMENT_CREATED = 'comment:created',
  COMMENT_UPDATED = 'comment:updated',
  COMMENT_DELETED = 'comment:deleted',

  // Notification events
  NOTIFICATION_NEW = 'notification:new',
  NOTIFICATION_READ = 'notification:read',
  NOTIFICATION_READ_ALL = 'notification:read_all',

  // Project events
  PROJECT_UPDATED = 'project:updated',
  PROJECT_MEMBER_JOINED = 'project:member_joined',

  // Presence events
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  USER_TYPING = 'user:typing',

  // AI events
  AI_PREDICTION_READY = 'ai:prediction_ready',
}
