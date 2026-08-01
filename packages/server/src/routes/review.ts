import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { getMyReviews, approveReview, rejectReview } from '../controllers/review';

const router: Router = Router();

router.use(authMiddleware);

router.get('/my', getMyReviews);
router.post('/:id/approve', approveReview);
router.post('/:id/reject', rejectReview);

export default router;
