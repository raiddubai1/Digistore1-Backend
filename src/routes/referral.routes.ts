import { Router } from 'express';
import * as referralController from '../controllers/referral.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get my referral code (requires auth)
router.get('/my-code', authenticate, referralController.getMyReferralCode);

// Get referral stats (requires auth)
router.get('/stats', authenticate, referralController.getReferralStats);

// Track referral click (public)
router.post('/track/:code', referralController.trackReferralClick);

export default router;

