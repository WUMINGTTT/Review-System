/**
 * 评分项相关类型定义
 *
 * 在 Prisma 方案下，DimensionScore 是独立表而非嵌入式数组。
 * RatingItem 与 DimensionScore 是一对多关系。
 */

import { RatingItemStatus } from '../constants/status';

/** 维度评分（独立表，每条记录对应一个维度的打分） */
export interface IDimensionScore {
  id?: number;
  ratingItemId?: number;
  dimensionId: number;
  dimensionName: string;
  score: number;
  maxScore: number;
  weight: number;
}

/** 评分项 */
export interface IRatingItem {
  id: number;
  evaluationId: number;
  participantId: number;
  evaluatorId: number;
  dimensionScores: IDimensionScore[];
  comments: string;
  totalScore: number;
  status: RatingItemStatus;
  savedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** 评分项列表项（带关联信息） */
export interface IRatingListItem {
  id: number;
  evaluationId: number;
  evaluationTitle: string;
  participantId: number;
  participantName: string;
  participantDepartment?: string;
  participantPosition?: string;
  status: RatingItemStatus;
  deadline?: string;
  totalScore: number;
  comments: string;
  dimensionScores: IDimensionScore[];
}

/** 保存评分请求参数 */
export interface ISaveRatingParams {
  dimensionScores: Omit<IDimensionScore, 'id' | 'ratingItemId'>[];
  comments?: string;
}

/** 评分项查询参数 */
export interface IRatingQuery {
  page?: number;
  limit?: number;
  evaluationId?: number;
  participantId?: number;
  evaluatorId?: number;
  status?: RatingItemStatus;
}

/** 评分统计（审核页用） */
export interface IRatingStats {
  totalParticipants: number;
  completedCount: number;
  pendingCount: number;
}
