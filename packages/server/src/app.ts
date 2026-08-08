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
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

// 导入自定义中间件
import { errorHandler } from './middlewares/errorHandler';

// 导入路由模块
import authRouter from './routes/auth';
import userRouter from './routes/user';
import evaluationRouter from './routes/evaluation';
import statsRouter from './routes/stats';
import reviewRouter from './routes/review';
import notificationRouter from './routes/notification';

// ========== 3. 初始化 Prisma Client ==========
// PrismaClient 是类型安全的数据库客户端，由 prisma generate 自动生成
// 实例化时会建立数据库连接池，整个应用应该共享同一个实例
// 单独导出，后续在 controllers/services 中通过 import { prisma } from '../app' 使用
export const prisma = new PrismaClient();

// ========== 4. 创建 Express 实例 ==========
const app = express();

// ========== 5. 注册全局中间件 ==========

// helmet() - 安全头中间件
// 自动设置各种 HTTP 安全头（X-Content-Type-Options、X-Frame-Options 等）
app.use(helmet());

// cors() - 跨域资源共享
// 前端（Vite 开发服务器，默认 5173 端口）和后端（3000 端口）不同源
// 不注册此中间件，浏览器会拦截前端的 API 请求
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);

// morgan() - 请求日志
// 开发环境使用 'dev' 格式（彩色简洁），生产环境使用 'combined' 格式（详细）
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// express.json() - 解析请求体
// 将 Content-Type: application/json 的请求体解析为 JS 对象
// 解析后通过 req.body 访问，不注册则 req.body 为 undefined
app.use(express.json());

// rateLimit() - API 限流
// 防止恶意请求，开发环境放宽限制
const isDev = process.env.NODE_ENV !== 'production';
const apiLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 15 * 60 * 1000, // 开发 1 分钟，生产 15 分钟
  max: isDev ? 300 : 100, // 开发 300 次，生产 100 次
  message: { success: false, error: '请求过于频繁，请稍后再试' },
});
app.use('/api/', apiLimiter);

// ========== 6. 注册路由 ==========

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/evaluations', evaluationRouter);
app.use('/api/stats', statsRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/notifications', notificationRouter);
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

// ========== 7. 错误处理中间件 ==========
// 必须放在所有路由之后，用于捕获和处理所有未处理的错误
app.use(errorHandler);

// ========== 8. 启动服务器 ==========
// process.env.PORT 从 .env 文件读取，若未配置则默认使用 3000
const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`服务器运行在：http://localhost:${PORT}`);
  console.log(`接口健康检查：http://localhost:${PORT}/api/health`);
});
