import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { getNotifications, getNotificationById, markAsRead, markAllAsRead, deleteNotification, deleteReadNotifications } from '../controllers/notification';

const router: Router = Router();

router.use(authMiddleware);
router.get('/', getNotifications);
router.get('/:id', getNotificationById);
router.put('/read-all', markAllAsRead);  // 放在 /:id/read 前面，避免参数捕获
router.put('/:id/read', markAsRead);
router.delete('/read', deleteReadNotifications);  // 删除所有已读通知
router.delete('/:id', deleteNotification);

export default router;
