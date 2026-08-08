import request from '@/utils/request'

// 获取待审核列表
export function getMyReviews() {
  return request.get('/reviews/my') as Promise<any>
}
