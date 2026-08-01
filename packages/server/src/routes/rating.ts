import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
  getMyRatings,
  getRatingById,
  saveRating,
  submitRating,
  checkCompletion,
  getRatingsByEvaluationId,
} from '../controllers/rating';

const router: Router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 获取我的待评分列表
router.get('/my', getMyRatings);

// 检查评价的评分完成状态（更具体的路由放在前面）
router.get('/evaluation/:evaluationId/completion', checkCompletion);

// 获取评价的评分结果（根据可见性判断权限）
router.get('/evaluation/:evaluationId', getRatingsByEvaluationId);

// 获取评分详情
router.get('/:id', getRatingById);

// 保存评分（自动保存/手动保存）
router.put('/:id', saveRating);

// 提交评分
router.post('/:id/submit', submitRating);

export default router;
