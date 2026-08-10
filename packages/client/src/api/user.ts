/**
 * 用户相关 API
 *
 * 职责: 封装所有用户相关的 HTTP 请求
 */

import request from '@/utils/request'

/**
 * 获取用户选项（精简版）
 * 用于选择评审人等场景，只返回 id、username、realName
 */
export function getUserOptions() {
  return request.get('/users/options') as Promise<any>
}

/**
 * 获取用户详情
 * @param id 用户 ID
 */
export function getUserById(id: number) {
  return request.get(`/users/${id}`) as Promise<any>
}

/**
 * 获取用户列表（管理员）
 */
export function getUsers(params?: { page?: number; pageSize?: number; keyword?: string }) {
  return request.get('/users', { params }) as Promise<any>
}

/**
 * 更新用户信息（管理员可修改 roles 和 isActive）
 */
export function updateUser(id: number, data: { realName?: string; email?: string; roles?: string[]; isActive?: boolean }) {
  return request.put(`/users/${id}`, data) as Promise<any>
}

/**
 * 启用/禁用用户
 */
export function updateUserStatus(id: number, isActive: boolean) {
  return request.patch(`/users/${id}/status`, { isActive }) as Promise<any>
}

/**
 * 删除用户
 */
export function deleteUser(id: number) {
  return request.delete(`/users/${id}`) as Promise<any>
}

/**
 * 管理员创建用户
 */
export function createUser(data: { username: string; password: string; realName: string; email?: string; roles?: string[] }) {
  return request.post('/users', data) as Promise<any>
}

/**
 * 修改密码
 * @param id 用户 ID
 * @param data 包含旧密码和新密码
 */
export function changePassword(id: number, data: { oldPassword: string; newPassword: string; confirmPassword: string }) {
  return request.put(`/users/${id}/password`, data) as Promise<any>
}
