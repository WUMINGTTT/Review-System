/**
 * 状态枚举常量
 */

/** 评价活动状态 */
export enum EvaluationStatus {
  /** 草稿 */
  DRAFT = 'draft',
  /** 已提交 */
  SUBMITTED = 'submitted',
  /** 已驳回 */
  REJECTED = 'rejected',
  /** 已通过 */
  APPROVED = 'approved',
  /** 已归档 */
  ARCHIVED = 'archived',
}

/** 评分项状态 */
export enum RatingItemStatus {
  /** 待评分 */
  PENDING = 'pending',
  /** 已暂存 */
  DRAFT = 'draft',
  /** 已提交 */
  SUBMITTED = 'submitted',
}

/** 通知类型 */
export enum NotificationType {
  /** 评价被提交（通知审核者） */
  EVALUATION_SUBMITTED = 'evaluation_submitted',
  /** 评价被通过 */
  EVALUATION_APPROVED = 'evaluation_approved',
  /** 评价被打回 */
  EVALUATION_REJECTED = 'evaluation_rejected',
  /** 评价被归档 */
  EVALUATION_ARCHIVED = 'evaluation_archived',
  /** 被分配为审核者 */
  ASSIGNED_AS_REVIEWER = 'assigned_as_reviewer',
  /** 被分配为被评价人 */
  ASSIGNED_AS_PARTICIPANT = 'assigned_as_participant',
  /** 评分截止提醒 */
  DEADLINE_REMINDER = 'deadline_reminder',
}
