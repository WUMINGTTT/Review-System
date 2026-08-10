import { Router } from 'express';
import {
  createEvaluation,
  getEvaluations,
  updateEvaluation,
  deleteEvaluation,
  adminDeleteEvaluation,
  getEvaluationById,
  submitEvaluation,
  rejectEvaluation,
  approveEvaluation,
  archiveEvaluation,
  submitRatings,
} from '../controllers/evaluation';
import { authMiddleware, roleGuard } from '../middlewares/auth';

const router: ReturnType<typeof Router> = Router();

// 管理员路由（放在 /:id 之前，避免被匹配）
router.delete('/admin/:id', authMiddleware, roleGuard('admin'), adminDeleteEvaluation);

// 所有路由都需要登录
router.post('/', authMiddleware, createEvaluation);
router.get('/', authMiddleware, getEvaluations);
router.get('/:id', authMiddleware, getEvaluationById);
router.put('/:id', authMiddleware, updateEvaluation);
router.delete('/:id', authMiddleware, deleteEvaluation);
router.post('/:id/submit', authMiddleware, submitEvaluation);
router.post('/:id/approve', authMiddleware, approveEvaluation);
router.post('/:id/reject', authMiddleware, rejectEvaluation);
router.post('/:id/archive', authMiddleware, archiveEvaluation);
router.post('/:id/ratings', authMiddleware, submitRatings);

export default router;
