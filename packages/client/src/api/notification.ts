import request from '@/utils/request'

// 获取通知列表
export function getNotifications(params?: { page?: number; pageSize?: number; isRead?: boolean }) {
  return request.get('/notifications', { params }) as Promise<any>
}

// 获取未读通知数（复用列表接口，只取未读）
export function getUnreadCount() {
  return request.get('/notifications', { params: { pageSize: 1, isRead: false } }) as Promise<any>
}

// 标记单条通知为已读
export function markAsRead(id: number) {
  return request.put(`/notifications/${id}/read`) as Promise<any>
}

// 标记所有通知为已读
export function markAllAsRead() {
  return request.put('/notifications/read-all') as Promise<any>
}

// 删除单条通知
export function deleteNotification(id: number) {
  return request.delete(`/notifications/${id}`) as Promise<any>
}

// 删除所有已读通知
export function deleteReadNotifications() {
  return request.delete('/notifications/read') as Promise<any>
}
