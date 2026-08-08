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
 *     /reviews      - 审核管理
 *     /archive      - 已归档
 *     /users        - 用户管理（仅管理员）
 *     /profile      - 个人中心
 */

import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

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
  {
    // 主布局路由
    path: '/',
    component: () => import('../components/layout/AppLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/dashboard/Index.vue'),
        meta: { title: '工作台' },
      },
      {
        path: 'evaluations',
        name: 'Evaluations',
        component: () => import('../views/evaluations/Index.vue'),
        meta: { title: '评价管理' },
      },
      {
        path: 'evaluations/create',
        name: 'EvaluationCreate',
        component: () => import('../views/evaluations/Create.vue'),
        meta: { title: '创建评价', backTo: '/evaluations' },
      },
      {
        path: 'evaluations/:id',
        name: 'EvaluationDetail',
        component: () => import('../views/evaluations/Detail.vue'),
        meta: { title: '评价详情', backTo: '/evaluations' },
      },
      {
        path: 'evaluations/:id/rate',
        name: 'EvaluationRate',
        component: () => import('../views/evaluations/Rate.vue'),
        meta: { title: '评分', backTo: '/evaluations' },
      },
      {
        path: 'reviews',
        name: 'Reviews',
        component: () => import('../views/reviews/Index.vue'),
        meta: { title: '审核管理' },
      },
      {
        path: 'notifications',
        name: 'Notifications',
        component: () => import('../views/notifications/Index.vue'),
        meta: { title: '通知中心' },
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('../views/users/Index.vue'),
        meta: { title: '用户管理', roles: ['admin'] },
      },
    ],
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
 * 4. 检查路由的 meta.roles，无权限用户重定向到工作台
 */
router.beforeEach(async (to, _from, next) => {
  // 从 localStorage 获取 Token
  const token = localStorage.getItem('token')

  // 设置页面标题
  document.title = `${to.meta.title || '评价系统'} - 评价系统`

  if (to.meta.requiresAuth === false) {
    // 不需要登录的页面（如登录页）
    // 已登录用户访问登录页时，跳转到工作台
    if (token && to.name === 'Login') {
      next({ name: 'Dashboard' })
    } else {
      next()
    }
  } else {
    // 需要登录的页面
    if (token) {
      // 如果有 token 但没有 userInfo，尝试获取用户信息
      const userStore = useUserStore()
      if (!userStore.userInfo) {
        try {
          await userStore.fetchUserInfo()
        } catch {
          // 获取用户信息失败（token 可能已过期），清除 token 并跳转登录页
          userStore.logout()
          next({ name: 'Login' })
          return
        }
      }

      // 检查路由是否需要特定角色
      const requiredRoles = to.meta.roles as string[] | undefined
      if (requiredRoles && requiredRoles.length > 0) {
        const userRoles = userStore.userInfo?.roles || []
        const hasRole = requiredRoles.some((role) => userRoles.includes(role))
        if (!hasRole) {
          // 无权限，重定向到工作台
          next({ name: 'Dashboard' })
          return
        }
      }

      next()
    } else {
      next({ name: 'Login' })
    }
  }
})

export default router
