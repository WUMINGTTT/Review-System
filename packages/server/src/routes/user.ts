import { Router } from 'express';
import {
  getUsers,
  getUserById,
  getUserOptions,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  changePassword,
} from '../controllers/user';
import { authMiddleware, roleGuard } from '../middlewares/auth';

const router: Router = Router();

router.get('/options', authMiddleware, getUserOptions); // 用户选项（所有登录用户可用）
router.get('/', authMiddleware, roleGuard('admin'), getUsers);
router.get('/:id', authMiddleware, getUserById);
router.post('/', authMiddleware, roleGuard('admin'), createUser);
router.put('/:id', authMiddleware, updateUser);
router.put('/:id/password', authMiddleware, changePassword);
router.patch('/:id/status', authMiddleware, roleGuard('admin'), updateUserStatus);
router.delete('/:id', authMiddleware, roleGuard('admin'), deleteUser);

export default router;
