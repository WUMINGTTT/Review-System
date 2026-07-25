/**
 * 评价活动相关类型定义
 *
 * 包含: 评价活动 (Evaluation)、评价人员 (Participant)、评价维度 (ScoreDimension)
 *
 * 数据关系:
 *   Evaluation (1) ──── (N) Participant      一次评价包含多个被评价人
 *   Evaluation (1) ──── (N) ScoreDimension   一次评价包含多个评分维度
 *   Participant  (1) ──── (N) RatingItem     每个被评价人产生多条评分记录（每人一个评审一条）
 *
 * 状态流转:
 *   DRAFT → SUBMITTED → APPROVED → ARCHIVED
 *                  ↘ REJECTED → (修改后重新提交) → SUBMITTED
 *
 * 关键设计决策:
 * - 组织者/评审者是评价活动中的临时身份，不是用户的固定角色
 * - 被评价人（Participant）由组织者手动填写，不依赖系统用户表
 *   原因: 被评价人不一定拥有系统账号（如外部人员、未注册的同事等）
 */

import { EvaluationStatus } from '../constants/status';

/**
 * 评价活动接口
 *
 * 对应 Prisma 模型: Evaluation
 * 作为整个评价流程的核心实体，管理从创建到归档的全生命周期
 */
export interface IEvaluation {
  /** 评价活动 ID（数据库自增主键） */
  id: number;
  /** 评价标题 */
  title: string;
  /** 评价描述/说明 */
  description: string;
  /**
   * 所属部门（可选）
   * 用于按部门筛选评价活动，默认取创建者的部门
   * 创建者也可以手动修改或留空
   */
  department?: string;
  /**
   * 评审人用户 ID 列表
   * 数据库中以 JSON 字符串存储，格式: "[1,2,3]"
   * 评审人必须是系统注册用户（需要登录系统进行评分操作）
   *
   * 注意: reviewerIds 中的用户在此评价中的身份是"评审人"，
   * 但这不代表他们是系统中的固定角色，评价结束后身份即失效
   */
  reviewerIds: number[];
  /**
   * 被评价人列表
   * 通过 Prisma relation 查询获取，对应 Participant 表
   *
   * 设计说明:
   * - 组织者手动填写被评价人信息（姓名、部门、职位等）
   * - 不从系统用户中选择，因为被评价人不一定有系统账号
   * - 被评价人不需要登录系统，仅作为数据记录存在
   */
  participants: IParticipant[];
  /**
   * 评分维度列表
   * 通过 Prisma relation 查询获取，对应 ScoreDimension 表
   */
  scoreDimensions: IScoreDimension[];
  /** 评价状态（见 constants/status.ts 中的 EvaluationStatus 枚举） */
  status: EvaluationStatus;
  /** 计划截止时间（ISO 8601 格式，可选） */
  deadline?: string;
  /** 创建人用户 ID（即本次评价的组织者） */
  createdBy: number;
  /** 创建时间（ISO 8601 格式字符串） */
  createdAt: string;
  /** 更新时间（ISO 8601 格式字符串） */
  updatedAt: string;
}

/**
 * 被评价人接口
 *
 * 对应 Prisma 模型: Participant
 * 独立表，通过 evaluationId 外键关联到 Evaluation
 *
 * 设计说明:
 * - 由组织者在创建评价时手动填写，不关联系统用户表
 * - 被评价人不需要拥有系统账号
 * - 同一个人可以在不同评价活动中被记录为不同的 Participant
 * - 信息以填写时的快照保存，即使被评价人后来注册了系统账号，也不会自动关联
 */
export interface IParticipant {
  /** 被评价人记录 ID（数据库自增主键） */
  id: number;
  /** 所属评价活动 ID（外键） */
  evaluationId: number;
  /** 被评价人姓名 */
  name: string;
  /** 被评价人所在部门 */
  department: string;
  /** 职位（可选） */
  position?: string;
  /** 联系电话（可选，便于组织者联系确认信息） */
  phone?: string;
}

/**
 * 评分维度接口
 *
 * 对应 Prisma 模型: ScoreDimension
 * 独立表，通过 evaluationId 外键关联到 Evaluation
 *
 * 设计说明:
 * - 每个维度有权重 (weight)，所有维度权重之和应为 100
 * - maxScore 定义该维度的满分值，评审人打分不能超过此值
 * - 同一评价活动中维度名称不允许重复（数据库唯一约束）
 */
export interface IScoreDimension {
  /** 维度 ID（数据库自增主键） */
  id: number;
  /** 所属评价活动 ID（外键） */
  evaluationId: number;
  /** 维度名称（如"工作能力"、"团队协作"） */
  name: string;
  /** 维度描述/评分标准说明 */
  description: string;
  /** 满分值（评审人打分上限） */
  maxScore: number;
  /**
   * 权重百分比（0-100）
   * 所有维度权重之和应等于 100
   * 用于计算加权总分: Σ(维度得分 × 权重%) = 最终得分
   */
  weight: number;
}
