/**
 * 评分相关类型定义
 *
 * 包含: 评分记录 (RatingItem)、维度评分 (DimensionScore)
 *
 * 数据关系:
 *   RatingItem (1) ──── (N) DimensionScore   一条评分记录包含多个维度的打分
 *   Participant (1) ──── (N) RatingItem       一个被评价人有多个评审人的评分记录
 *
 * 评分流程:
 *   1. 组织者创建评价 → 系统为每个 (被评价人 × 评审人) 自动生成 RatingItem（PENDING）
 *   2. 评审人进入评分页 → 填写各维度分数 → 暂存（DRAFT）或直接提交（SUBMITTED）
 *   3. 暂存后可继续修改，提交后不可修改
 */

import { RatingItemStatus } from '../constants/status';

/**
 * 评分记录接口
 *
 * 对应 Prisma 模型: RatingItem
 * 代表一个评审人对一个被评价人的完整评分记录
 *
 * 数据库表名: rating_item (snake_case)
 * 唯一约束: (evaluationId, participantId, reviewerId) 确保同一评审人对同一被评价人只有一条记录
 */
export interface IRatingItem {
  /** 评分记录 ID（数据库自增主键） */
  id: number;
  /** 所属评价活动 ID（外键） */
  evaluationId: number;
  /** 被评价人 ID（外键 → Participant 表） */
  participantId: number;
  /** 评审人用户 ID（外键 → User 表） */
  reviewerId: number;
  /** 评分状态（见 constants/status.ts 中的 RatingItemStatus 枚举） */
  status: RatingItemStatus;
  /**
   * 各维度评分列表
   * 通过 Prisma relation 查询获取，对应 DimensionScore 表
   * 提交时需校验: 数量 = 评价维度数，每个分数 ≤ 对应维度的 maxScore
   */
  dimensionScores: IDimensionScore[];
  /**
   * 评语文本（可选）
   * 评审人对被评价人的总体评价文字，与维度分数分开存储
   */
  comment?: string;
  /** 创建时间（ISO 8601 格式字符串） */
  createdAt: string;
  /** 更新时间（ISO 8601 格式字符串，每次暂存/提交都会更新） */
  updatedAt: string;
}

/**
 * 维度评分接口
 *
 * 对应 Prisma 模型: DimensionScore
 * 独立表，通过 ratingItemId 外键关联到 RatingItem
 *
 * 设计说明:
 * - dimensionId 引用 ScoreDimension 表的 ID
 * - dimensionName 是冗余字段，避免查询时额外 JOIN ScoreDimension 表
 * - maxScore 和 weight 同样是冗余字段，记录评分时的快照值
 *   这样即使后续修改了维度配置，历史评分数据仍然准确
 */
export interface IDimensionScore {
  /** 维度评分 ID（数据库自增主键，暂存时可能为空） */
  id?: number;
  /** 所属评分记录 ID（外键，新建时可能为空） */
  ratingItemId?: number;
  /** 评分维度 ID（外键 → ScoreDimension 表） */
  dimensionId: number;
  /** 维度名称（冗余快照，记录评分时的维度名称） */
  dimensionName: string;
  /** 评审人给出的分数（不能超过 maxScore） */
  score: number;
  /** 该维度的满分值（冗余快照，来自 ScoreDimension.maxScore） */
  maxScore: number;
  /** 该维度的权重百分比（冗余快照，来自 ScoreDimension.weight，0-100） */
  weight: number;
}

/**
 * 暂存评分请求参数
 *
 * 调用时机: 评审人填写过程中点击"暂存"按钮
 * 行为: 保存当前填写的分数和评语，状态变为 DRAFT，可继续修改
 */
export interface SaveRatingRequest {
  /** 被评价人 ID */
  participantId: number;
  /** 各维度评分列表（不要求全部填满） */
  dimensionScores: Omit<IDimensionScore, 'id' | 'ratingItemId'>[];
  /** 评语（可选） */
  comment?: string;
}

/**
 * 提交评分请求参数
 *
 * 调用时机: 评审人确认后点击"提交"按钮
 * 行为: 校验所有维度均已打分 → 保存 → 状态变为 SUBMITTED → 不可再修改
 */
export interface SubmitRatingRequest {
  /** 被评价人 ID */
  participantId: number;
  /** 各维度评分列表（必须全部填写，数量等于评价维度数） */
  dimensionScores: Omit<IDimensionScore, 'id' | 'ratingItemId'>[];
  /** 评语（可选，但建议评审人填写） */
  comment?: string;
}
