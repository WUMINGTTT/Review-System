import request from '@/utils/request'

// 获取工作台统计数据
export function getDashboardStats() {
  return request.get('/stats/dashboard') as Promise<any>
}
