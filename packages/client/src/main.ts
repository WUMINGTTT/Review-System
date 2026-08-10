/**
 * 应用入口文件
 *
 * 职责:
 * 1. 创建 Vue 应用实例
 * 2. 注册全局插件（路由、状态管理）
 * 3. 挂载到 DOM
 *
 * 注意: Element Plus 已配置按需自动导入（见 vite.config.ts）
 * 无需在此文件中全局注册，组件会自动按需引入
 */

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import 'element-plus/dist/index.css'
import './styles/global.css'

const app = createApp(App)

// 注册路由
app.use(router)

// 注册 Pinia 状态管理
app.use(createPinia())

// 挂载到 DOM
app.mount('#app')
