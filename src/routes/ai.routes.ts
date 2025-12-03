import express from 'express';
import * as aiController from '../controllers/ai.controller';

const router = express.Router();

// AI content generation endpoint (no auth required for now, can add admin check later)
router.post('/generate', aiController.generateProductContent);

export default router;

