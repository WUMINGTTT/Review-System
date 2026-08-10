/**
 * 认证相关 API
 */

import request from '@/utils/request'

/**
 * 登录
 */
export function loginApi(username: string, password: string): Promise<any> {
  return request.post('/auth/login', { username, password })
}

/**
 * 注册
 */
export function registerApi(data: { username: string; password: string; realName: string; email?: string }): Promise<any> {
  return request.post('/auth/register', data)
}
