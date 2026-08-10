import request from '@/utils/request';

// 获取评价列表
export function getEvaluations(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}) {
  return request.get('/evaluations', { params }) as Promise<any>;
}

// 获取评价详情
export function getEvaluationById(id: number) {
  return request.get(`/evaluations/${id}`) as Promise<any>;
}

// 创建评价
export function createEvaluation(data: {
  title: string;
  description: string;
  participants: { name: string; description?: string; phone?: string }[];
  reviewerIds: number[];
  scoreDimensions: { name: string; description?: string; maxScore?: number; weight: number }[];
}) {
  return request.post('/evaluations', data) as Promise<any>;
}

// 更新评价
export function updateEvaluation(
  id: number,
  data: {
    title?: string;
    description?: string;
    participants?: { name: string; description?: string; phone?: string }[];
    reviewerIds?: number[];
    scoreDimensions?: { name: string; description?: string; maxScore?: number; weight: number }[];
  },
) {
  return request.put(`/evaluations/${id}`, data) as Promise<any>;
}

// 删除评价
export function deleteEvaluation(id: number) {
  return request.delete(`/evaluations/${id}`) as Promise<any>;
}

// 管理员删除评价（无状态限制）
export function adminDeleteEvaluation(id: number) {
  return request.delete(`/evaluations/admin/${id}`) as Promise<any>;
}

// 提交评价（DRAFT/REJECTED → SUBMITTED）
export function submitEvaluation(id: number) {
  return request.post(`/evaluations/${id}/submit`) as Promise<any>;
}

// 审核通过（SUBMITTED → APPROVED）
export function approveEvaluation(id: number) {
  return request.post(`/evaluations/${id}/approve`) as Promise<any>;
}

// 审核打回（SUBMITTED → REJECTED）
export function rejectEvaluation(id: number, rejectReason: string) {
  return request.post(`/evaluations/${id}/reject`, { rejectReason }) as Promise<any>;
}

// 归档评价（APPROVED → ARCHIVED）
export function archiveEvaluation(id: number) {
  return request.post(`/evaluations/${id}/archive`) as Promise<any>;
}

// 提交评分（创建者为被评价人打分）
export function submitRatings(
  id: number,
  ratings: {
    participantId: number;
    scores: { dimensionId: number; score: number }[];
    comment?: string;
  }[],
) {
  return request.post(`/evaluations/${id}/ratings`, { ratings }) as Promise<any>;
}
