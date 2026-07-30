import { Router } from 'express';
import { getDashboardStats } from '../controllers/stats';
import { authMiddleware } from '../middlewares/auth';

const router: ReturnType<typeof Router> = Router();

// 工作台统计数据（所有登录用户可用）
router.get('/dashboard', authMiddleware, getDashboardStats);

export default router;
