import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification';

const router: Router = Router();

router.use(authMiddleware);
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);  // 放在 /:id/read 前面，避免参数捕获
router.put('/:id/read', markAsRead);

export default router;
