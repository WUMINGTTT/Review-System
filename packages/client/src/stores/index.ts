/**
 * Pinia 状态管理配置
 *
 * Pinia 是 Vue 3 官方推荐的状态管理库，替代 Vuex
 *
 * 使用方式:
 *   1. 在此目录下创建各模块的 store 文件（如 user.ts、evaluation.ts）
 *   2. 在组件中通过 useXxxStore() 使用
 *
 * @example
 * // stores/user.ts
 * import { defineStore } from 'pinia'
 * export const useUserStore = defineStore('user', {
 *   state: () => ({ token: '', userInfo: null }),
 *   actions: {
 *     async login(username: string, password: string) { ... }
 *   }
 * })
 *
 * // 在组件中使用
 * import { useUserStore } from '@/stores/user'
 * const userStore = useUserStore()
 * userStore.login('admin', '123456')
 */

// Pinia 实例在 main.ts 中通过 createPinia() 创建并注册
// 此文件作为 store 模块的统一导出入口

export {} // 占位，后续添加 store 模块后在此统一导出
