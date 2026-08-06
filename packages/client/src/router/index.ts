/**
 * Vue Router 路由配置
 *
 * 职责:
 * 1. 定义路由表（路径 → 组件映射）
 * 2. 配置路由模式（history 模式，URL 不带 # 号）
 * 3. 全局路由守卫（登录验证、权限控制）
 *
 * 路由结构规划:
 *   /login          - 登录页（未登录可访问）
 *   /               - 主布局（需要登录）
 *     /dashboard    - 工作台
 *     /evaluations  - 评价列表
 *     /ratings      - 我的评分
 *     /review       - 审核管理
 *     /archive      - 已归档
 *     /users        - 用户管理（仅管理员）
 *     /profile      - 个人中心
 */

import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

/**
 * 路由表
 *
 * 设计说明:
 * - 登录页单独一个路由，不嵌套在主布局中
 * - 其他页面嵌套在 MainLayout 下，共享侧边栏/顶栏
 * - meta.roles 用于权限控制，不设置表示所有登录用户可访问
 * - meta.title 用于页面标题和面包屑导航
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/login/Index.vue'),
    meta: { title: '登录', requiresAuth: false },
  },
  // TODO: 后续添加主布局路由和子页面路由
  {
    // 根路径重定向到登录页
    path: '/',
    redirect: '/login',
    meta: { requiresAuth: false },
  },
]

/**
 * 创建路由实例
 *
 * createWebHistory() 使用 HTML5 History 模式
 * 优点: URL 美观（/login 而非 /#/login）
 * 注意: 生产环境需要 Nginx 配置 try_files，否则刷新会 404
 */
const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * 全局前置守卫
 *
 * 在每次路由跳转前执行，用于:
 * 1. 检查用户是否已登录（Token 是否存在）
 * 2. 未登录用户重定向到登录页
 * 3. 已登录用户访问登录页时重定向到首页
 *
 * TODO: 后续在此处添加角色权限校验逻辑
 */
router.beforeEach((to, _from, next) => {
  // 从 localStorage 获取 Token
  const token = localStorage.getItem('token')

  // 设置页面标题
  document.title = `${to.meta.title || '评价系统'} - 评价系统`

  if (to.meta.requiresAuth === false) {
    // 不需要登录的页面（如登录页）
    // TODO: 后续创建 Dashboard 后，已登录用户访问登录页时跳转到 Dashboard
    next()
  } else {
    // 需要登录的页面
    if (token) {
      next()
    } else {
      next({ name: 'Login' })
    }
  }
})

export default router
