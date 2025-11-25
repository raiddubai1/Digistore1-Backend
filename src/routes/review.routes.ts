import { Router } from 'express';
import { body } from 'express-validator';
import * as reviewController from '../controllers/review.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Get reviews for a product
router.get('/product/:productId', reviewController.getProductReviews);

// Protected routes
router.post(
  '/',
  authenticate,
  [
    body('productId').notEmpty(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').trim().notEmpty(),
  ],
  validate,
  reviewController.createReview
);

router.put('/:id', authenticate, reviewController.updateReview);
router.delete('/:id', authenticate, reviewController.deleteReview);

export default router;

