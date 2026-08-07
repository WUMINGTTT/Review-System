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
