/**
 * 状态枚举常量
 *
 * 集中管理所有业务状态枚举，前后端共用
 * 与 Prisma Schema 中的 enum 定义保持一致
 *
 * 使用方式:
 *   import { EvaluationStatus, RatingItemStatus, NotificationType } from '@review-system/shared'
 *
 * 注意: Prisma enum 在 TypeScript 中会自动生成对应的类型，
 * 这里的枚举主要用于前后端共享，确保状态值一致
 */

/**
 * 评价活动状态枚举
 *
 * 状态流转图:
 *   DRAFT ──────→ SUBMITTED ──────→ APPROVED ──────→ ARCHIVED
 *     ↑                │
 *     │                ↓
 *     └─────────── REJECTED (驳回后可修改并重新提交)
 *
 * 各状态说明:
 * - DRAFT:     草稿状态，组织者可编辑评价内容、维度、人员
 * - SUBMITTED: 已提交，等待管理员审核，组织者不可编辑
 * - REJECTED:  被驳回，管理员填写驳回理由，组织者可修改后重新提交
 * - APPROVED:  已通过，系统自动为每个 (被评价人×评审人) 生成评分记录
 * - ARCHIVED:  已归档，所有评分完成后归档，数据只读
 */
export enum EvaluationStatus {
  /** 草稿 - 可编辑，未提交 */
  DRAFT = 'draft',
  /** 已提交 - 等待审核 */
  SUBMITTED = 'submitted',
  /** 已驳回 - 需要修改后重新提交 */
  REJECTED = 'rejected',
  /** 已通过 - 评分进行中 */
  APPROVED = 'approved',
  /** 已归档 - 评分完成，数据只读 */
  ARCHIVED = 'archived',
}

/**
 * 评分项状态枚举
 *
 * 状态流转图:
 *   PENDING ──────→ DRAFT ──────→ SUBMITTED
 *     ↑               │
 *     └───────────────┘ (暂存后可继续修改)
 *
 * 各状态说明:
 * - PENDING:   待评分，评价通过后系统自动生成，评审人尚未开始填写
 * - DRAFT:     已暂存，评审人填写了部分或全部分数并暂存，可继续修改
 * - SUBMITTED: 已提交，评审人确认提交，不可再修改
 *
 * 数据生成时机:
 *   评价状态变为 APPROVED 时，系统自动为每个 (Participant × Reviewer) 组合
 *   创建一条 RatingItem 记录，初始状态为 PENDING
 */
export enum RatingItemStatus {
  /** 待评分 - 尚未开始填写 */
  PENDING = 'pending',
  /** 已暂存 - 部分或全部填写，可修改 */
  DRAFT = 'draft',
  /** 已提交 - 不可修改 */
  SUBMITTED = 'submitted',
}

/**
 * 通知类型枚举
 *
 * 用于标识通知的触发场景，前端根据类型展示不同的图标和跳转逻辑
 *
 * 触发场景对照:
 * - EVALUATION_SUBMITTED:   评价提交后 → 通知审核者
 * - EVALUATION_APPROVED:    评价审核通过 → 通知组织者
 * - EVALUATION_REJECTED:    评价被打回 → 通知组织者
 * - EVALUATION_ARCHIVED:    评价归档 → 通知组织者和所有参与的评审人
 * - ASSIGNED_AS_REVIEWER:   被分配为评审人 → 通知该评审人
 * - DEADLINE_REMINDER:        评分截止提醒 → 通知未完成评分的评审人
 *
 * 注意: 被评价人（Participant）不关联系统用户，无法接收站内通知，
 *       如需通知被评价人应通过外部渠道（如邮件、短信、微信）
 */
export enum NotificationType {
  /** 评价被提交（通知审核者进行审核） */
  EVALUATION_SUBMITTED = 'evaluation_submitted',
  /** 评价被通过（通知组织者，评分已开始） */
  EVALUATION_APPROVED = 'evaluation_approved',
  /** 评价被打回（通知组织者，需修改后重新提交） */
  EVALUATION_REJECTED = 'evaluation_rejected',
  /** 评价被归档（通知组织者和评审人，评分已结束） */
  EVALUATION_ARCHIVED = 'evaluation_archived',
  /** 被分配为审核者（通知评审人有新的评分任务） */
  ASSIGNED_AS_REVIEWER = 'assigned_as_reviewer',
  /** 评分截止提醒（通知未完成评分的评审人） */
  DEADLINE_REMINDER = 'deadline_reminder',
}
