import { Router } from 'express';
import * as bundleController from '../controllers/bundle.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', bundleController.getAllBundles);
router.get('/:slug', bundleController.getBundleBySlug);

// Admin routes
router.get('/admin/all', authenticate, authorize('ADMIN'), bundleController.getAllBundlesAdmin);
router.post('/', authenticate, authorize('ADMIN'), bundleController.createBundle);
router.put('/:id', authenticate, authorize('ADMIN'), bundleController.updateBundle);
router.delete('/:id', authenticate, authorize('ADMIN'), bundleController.deleteBundle);

export default router;

