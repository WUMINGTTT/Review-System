import { Router } from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
} from '../controllers/user';
import { authMiddleware, roleGuard } from '../middlewares/auth';

const router: ReturnType<typeof Router> = Router();

router.get('/', authMiddleware, roleGuard('admin'), getUsers);
router.get('/:id', authMiddleware, getUserById);
router.put('/:id', authMiddleware, updateUser);
router.patch('/:id/status', authMiddleware, roleGuard('admin'), updateUserStatus);
router.delete('/:id', authMiddleware, roleGuard('admin'), deleteUser);

export default router;
