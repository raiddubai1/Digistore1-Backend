import { Router } from 'express';
import { body } from 'express-validator';
import * as blogController from '../controllers/blog.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Public routes
router.get('/', blogController.getAllPosts);
router.get('/categories', blogController.getCategories);
router.get('/:slug', blogController.getPostBySlug);

// Admin routes
router.get('/admin/all', authenticate, authorize('ADMIN'), blogController.getAllPostsAdmin);
router.get('/admin/:id', authenticate, authorize('ADMIN'), blogController.getPostById);

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  [
    body('slug').trim().notEmpty().withMessage('Slug is required'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('excerpt').trim().notEmpty().withMessage('Excerpt is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
  ],
  validate,
  blogController.createPost
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  blogController.updatePost
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  blogController.deletePost
);

export default router;

