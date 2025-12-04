import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public settings (for frontend display - store name, logo, currency, etc.)
router.get('/public', settingsController.getPublicSettings);

// Protected routes (admin only)
router.get('/', authenticate, authorize('ADMIN'), settingsController.getAllSettings);
router.put('/', authenticate, authorize('ADMIN'), settingsController.updateSettings);
router.put('/:key', authenticate, authorize('ADMIN'), settingsController.updateSetting);

export default router;

