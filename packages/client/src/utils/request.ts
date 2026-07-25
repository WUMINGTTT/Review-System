/**
 * Axios 请求封装
 *
 * 职责:
 * 1. 创建统一的 axios 实例，设置 baseURL
 * 2. 请求拦截器：自动在请求头中携带 JWT Token
 * 3. 响应拦截器：统一处理错误（401 跳转登录、网络错误提示）
 * 4. 导出类型安全的请求方法供各模块使用
 *
 * 使用方式:
 *   import request from '@/utils/request'
 *   const res = await request.get('/users')
 *   const res = await request.post('/auth/login', { username, password })
 */

import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'

/**
 * 创建 axios 实例
 *
 * baseURL: 后端 API 地址
 *   开发环境: http://localhost:3000/api（后端服务）
 *   生产环境: /api（由 Nginx 反向代理，同源无需完整地址）
 *
 * timeout: 请求超时时间（毫秒），超时后自动取消请求
 */
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:3000/api' : '/api',
  timeout: 10000,
})

/**
 * 请求拦截器
 *
 * 在每个请求发出前执行，用于:
 * 1. 从 localStorage 读取 Token
 * 2. 将 Token 添加到请求头 Authorization 字段
 * 3. 后端 auth 中间件通过此字段验证用户身份
 *
 * InternalAxiosRequestConfig 是 axios 内部的请求配置类型
 * 必须返回 config，否则请求会被中断
 */
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token) {
      // Bearer 是 JWT Token 的标准前缀
      // 后端解析时会去掉 "Bearer " 前缀，取后面的 Token 字符串
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    // 请求发出前的错误（如网络断开、请求配置错误）
    return Promise.reject(error)
  }
)

/**
 * 响应拦截器
 *
 * 在每个响应返回后执行，用于:
 * 1. 统一处理 HTTP 错误状态码
 * 2. 401 未授权 → 清除 Token 并跳转登录页
 * 3. 其他错误 → 弹出错误提示
 *
 * 注意: 这里处理的是 HTTP 层面的错误
 * 业务层面的错误（如"用户名已存在"）由各模块自行处理
 */
request.interceptors.response.use(
  (response: AxiosResponse) => {
    // HTTP 状态码 2xx，直接返回数据
    return response
  },
  (error) => {
    if (error.response) {
      // 服务器返回了错误状态码
      const { status } = error.response

      switch (status) {
        case 401:
          // Token 过期或无效，清除本地登录状态并跳转登录
          localStorage.removeItem('token')
          ElMessage.error('登录已过期，请重新登录')
          window.location.href = '/login'
          break
        case 403:
          ElMessage.error('没有权限执行此操作')
          break
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        case 500:
          ElMessage.error('服务器内部错误')
          break
        default:
          ElMessage.error(error.response.data?.message || '请求失败')
      }
    } else if (error.code === 'ECONNABORTED') {
      // 请求超时
      ElMessage.error('请求超时，请稍后重试')
    } else {
      // 网络断开等无法连接服务器的情况
      ElMessage.error('网络连接失败，请检查网络')
    }

    return Promise.reject(error)
  }
)

export default request
