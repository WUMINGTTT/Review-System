import { Router } from 'express';
import { register, login, loginByEmail } from '../controllers/auth';

const router: Router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/login-by-email', loginByEmail);

export default router;
