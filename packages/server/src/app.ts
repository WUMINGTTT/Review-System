/**
 * Express 服务器入口文件
 *
 * 职责:
 * 1. 加载环境变量（必须最先执行）
 * 2. 初始化 Prisma Client（数据库连接）
 * 3. 注册全局中间件（CORS、JSON 解析）
 * 4. 注册路由
 * 5. 启动 HTTP 服务器
 *
 * 启动方式:
 *   开发环境: pnpm dev （使用 tsx watch 热重载）
 *   生产环境: pnpm build && pnpm start （编译后运行）
 */

// ========== 1. 加载环境变量 ==========
// dotenv/config 会读取项目根目录下的 .env 文件，将其中的键值对注入 process.env
// 必须在所有其他模块导入之前执行，否则后续代码读不到环境变量
import 'dotenv/config';

// ========== 2. 导入依赖 ==========
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import authRouter from './routes/auth';
import userRouter from './routes/user';

// ========== 3. 初始化 Prisma Client ==========
// PrismaClient 是类型安全的数据库客户端，由 prisma generate 自动生成
// 实例化时会建立数据库连接池，整个应用应该共享同一个实例
// 单独导出，后续在 controllers/services 中通过 import { prisma } from '../app' 使用
export const prisma = new PrismaClient();

// ========== 4. 创建 Express 实例 ==========
const app = express();

// ========== 5. 注册全局中间件 ==========

// cors() - 跨域资源共享
// 前端（Vite 开发服务器，默认 5173 端口）和后端（3000 端口）不同源
// 不注册此中间件，浏览器会拦截前端的 API 请求
app.use(cors());

// express.json() - 解析请求体
// 将 Content-Type: application/json 的请求体解析为 JS 对象
// 解析后通过 req.body 访问，不注册则 req.body 为 undefined
app.use(express.json());

// ========== 6. 注册路由 ==========

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
// 健康检查接口
// 用途: 验证服务器是否正常运行、数据库是否可连接
// 常见使用场景:
//   - 部署后快速验证服务状态
//   - 负载均衡器定期探活
//   - 开发时确认服务器已启动
app.get('/api/health', async (_req, res) => {
  try {
    // 执行一条最简单的数据库查询，验证连接是否正常
    // SELECT 1 是 SQL 中最轻量的查询，不访问任何表
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      data: {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // 数据库连接失败时返回 500 错误
    res.status(500).json({
      success: false,
      message: '数据库连接失败',
      data: {
        status: 'error',
        database: 'disconnected',
      },
    });
  }
});

// ========== 7. 启动服务器 ==========
// process.env.PORT 从 .env 文件读取，若未配置则默认使用 3000
const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
