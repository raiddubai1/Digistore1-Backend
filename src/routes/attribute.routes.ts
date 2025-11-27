import { Router } from 'express';
import {
  getAttributes,
  getAttribute,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  getProductAttributes,
  setProductAttributes,
} from '../controllers/attribute.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Attribute routes (Admin only)
router.get('/', getAttributes);
router.get('/:id', getAttribute);
router.post('/', authenticate, authorize('ADMIN'), createAttribute);
router.put('/:id', authenticate, authorize('ADMIN'), updateAttribute);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteAttribute);

// Product attribute routes
router.get('/product/:productId', getProductAttributes);
router.post('/product/:productId', authenticate, authorize('ADMIN', 'VENDOR'), setProductAttributes);

export default router;

