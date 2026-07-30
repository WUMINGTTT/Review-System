import { Router } from 'express';
import {
  createEvaluation,
  getEvaluations,
  updateEvaluation,
  deleteEvaluation,
  getEvaluationById,
  submitEvaluation,
  rejectEvaluation,
  approveEvaluation,
  archiveEvaluation,
} from '../controllers/evaluation';
import { authMiddleware } from '../middlewares/auth';

const router: ReturnType<typeof Router> = Router();

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

export default router;
