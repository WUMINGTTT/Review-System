/**
 * 认证相关 API
 *
 * 职责: 封装所有认证相关的 HTTP 请求
 * 统一管理接口，便于复用和维护
 */

import request from '@/utils/request'

/**
 * 登录
 * @param username 用户名
 * @param password 密码
 */
export function loginApi(username: string, password: string) {
  return request.post('/auth/login', { username, password })
}

/**
 * 获取当前用户信息
 */
export function getMeApi() {
  return request.get('/auth/me')
}

/**
 * 修改密码
 * @param oldPassword 旧密码
 * @param newPassword 新密码
 */
export function changePasswordApi(oldPassword: string, newPassword: string) {
  return request.post('/auth/change-password', { oldPassword, newPassword })
}
