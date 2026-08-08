/**
 * Vite 构建配置
 *
 * Vite 是 Vue 3 官方推荐的构建工具，提供:
 * - 极快的开发服务器启动（基于 ESM 原生模块）
 * - 热模块替换（HMR，修改代码后浏览器即时更新）
 * - 生产环境优化打包（Rollup）
 */

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import VueDevTools from 'vite-plugin-vue-devtools';

// 自动导入插件
// unplugin-auto-import: 自动导入 Vue/Router/Pinia 等的 API（ref、computed、useRouter 等）
// 无需在每个文件中手动 import { ref } from 'vue'
import AutoImport from 'unplugin-auto-import/vite';

// unplugin-vue-components: 自动注册组件（Element Plus 的 el-button、el-input 等）
// 无需手动 import 和 app.use() 注册
import Components from 'unplugin-vue-components/vite';

// Element Plus 自动导入解析器
// 配合 unplugin-vue-components 使用，识别 el-* 组件并按需导入
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig({
  server: {
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    vue(),
    // 自动导入 Vue、Vue Router、Pinia 的 API
    // 生成 auto-imports.d.ts 提供 TypeScript 类型支持
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    // 自动注册 Element Plus 组件
    // 生成 components.d.ts 提供 TypeScript 类型支持
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
    VueDevTools(),
  ],
});
