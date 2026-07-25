/**
 * 评价活动相关类型定义
 *
 * 注意：Prisma 会从 schema.prisma 自动生成类型，
 * 这里的接口定义用于前后端共享的请求/响应参数类型。
 * 实际数据库模型类型以 Prisma 生成的为准。
 */

import { EvaluationStatus } from '../constants/status';

/** 被评价人（独立表，不再嵌入 Evaluation） */
export interface IParticipant {
  id: number;
  evaluationId: number;
  name: string;
  department: string;
  position?: string;
  phone?: string;
}

/** 评分维度模板 */
export interface IScoreDimension {
  id: number;
  name: string;
  description?: string;
  maxScore: number;
  weight: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 创建评价请求参数 */
export interface ICreateEvaluationParams {
  title: string;
  description?: string;
  eventDate: string;
  reviewerId: number;
  participants: Omit<IParticipant, 'id' | 'evaluationId'>[];
  dimensionIds?: number[];
}

/** 更新评价请求参数 */
export interface IUpdateEvaluationParams {
  title?: string;
  description?: string;
  eventDate?: string;
  reviewerId?: number;
  participants?: Omit<IParticipant, 'evaluationId'>[];
}

/** 评价活动查询参数 */
export interface IEvaluationQuery {
  page?: number;
  limit?: number;
  status?: EvaluationStatus;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

/** 评价活动（完整，含关联） */
export interface IEvaluation {
  id: number;
  title: string;
  description?: string;
  eventDate: string;
  organizerId: number;
  reviewerId: number;
  participants: IParticipant[];
  status: EvaluationStatus;
  rejectReason?: string;
  reviewComment?: string;
  submittedAt?: string;
  reviewedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** 评价列表项（带关联信息） */
export interface IEvaluationListItem {
  id: number;
  title: string;
  description?: string;
  eventDate: string;
  status: EvaluationStatus;
  organizer: {
    id: number;
    realName: string;
    avatar?: string;
  };
  reviewer: {
    id: number;
    realName: string;
    avatar?: string;
  };
  ratingProgress?: {
    total: number;
    completed: number;
  };
  createdAt: string;
}

/** 评分维度查询参数 */
export interface IDimensionQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  isActive?: boolean;
}

/** 创建/更新评分维度参数 */
export interface IDimensionParams {
  name: string;
  description?: string;
  maxScore: number;
  weight: number;
  isActive?: boolean;
}
