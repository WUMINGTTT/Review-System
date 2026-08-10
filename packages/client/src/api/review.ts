import request from '@/utils/request'

// 获取审核列表（支持状态筛选和分页）
export function getMyReviews(params?: { status?: 'pending' | 'reviewed'; page?: number; pageSize?: number }) {
  return request.get('/reviews/my', { params }) as Promise<any>
}
