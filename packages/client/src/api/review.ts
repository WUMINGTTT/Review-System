import request from '@/utils/request'

// 获取审核列表（支持状态筛选）
export function getMyReviews(params?: { status?: 'pending' | 'reviewed' }) {
  return request.get('/reviews/my', { params }) as Promise<any>
}
