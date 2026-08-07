import request from '@/utils/request'

// 获取我的待评分列表
export function getMyRatings(evaluationId?: number) {
  return request.get('/ratings/my', {
    params: evaluationId ? { evaluationId } : undefined,
  }) as Promise<any>
}

// 获取评分详情
export function getRatingById(id: number) {
  return request.get(`/ratings/${id}`) as Promise<any>
}

// 保存评分（暂存）
export function saveRating(
  id: number,
  data: {
    comment?: string
    scores: { dimensionId: number; score: number }[]
  }
) {
  return request.put(`/ratings/${id}`, data) as Promise<any>
}

// 提交评分
export function submitRating(
  id: number,
  data: {
    comment?: string
    scores: { dimensionId: number; score: number }[]
  }
) {
  return request.post(`/ratings/${id}/submit`, data) as Promise<any>
}

// 检查评价的评分完成状态
export function checkCompletion(evaluationId: number) {
  return request.get(`/ratings/evaluation/${evaluationId}/completion`) as Promise<any>
}

// 获取评价的评分结果
export function getRatingsByEvaluationId(evaluationId: number) {
  return request.get(`/ratings/evaluation/${evaluationId}`) as Promise<any>
}
