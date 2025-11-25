import { Router } from 'express';
import * as downloadController from '../controllers/download.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Generate download link (requires authentication)
router.post('/generate/:orderItemId', authenticate, downloadController.generateDownloadLink);

// Download file (uses token, no auth required)
router.get('/:token', downloadController.downloadFile);

export default router;

