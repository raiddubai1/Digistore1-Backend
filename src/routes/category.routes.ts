import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:slug', categoryController.getCategoryBySlug);

// Admin only
router.post('/', authenticate, authorize('ADMIN'), categoryController.createCategory);
router.put('/:id', authenticate, authorize('ADMIN'), categoryController.updateCategory);
router.delete('/:id', authenticate, authorize('ADMIN'), categoryController.deleteCategory);

export default router;

