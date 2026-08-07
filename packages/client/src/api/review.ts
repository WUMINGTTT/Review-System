import request from '@/utils/request'

// 获取待审核列表
export function getMyReviews() {
  return request.get('/reviews/my') as Promise<any>
}

// 审核通过
export function approveReview(id: number) {
  return request.post(`/reviews/${id}/approve`) as Promise<any>
}

// 审核驳回
export function rejectReview(id: number, rejectReason: string) {
  return request.post(`/reviews/${id}/reject`, { rejectReason }) as Promise<any>
}
