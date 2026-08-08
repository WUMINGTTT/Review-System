/**
 * 认证相关 API
 */

import request from '@/utils/request'

/**
 * 登录
 */
export function loginApi(username: string, password: string) {
  return request.post<any>('/auth/login', { username, password })
}

/**
 * 注册
 */
export function registerApi(data: { username: string; password: string; realName: string; email?: string }) {
  return request.post<any>('/auth/register', data)
}
