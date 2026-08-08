import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { getMyReviews } from '../controllers/review';

const router: Router = Router();

router.use(authMiddleware);

router.get('/my', getMyReviews);

export default router;
