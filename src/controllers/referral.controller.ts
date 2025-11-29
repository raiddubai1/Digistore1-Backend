import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

// Commission rate (10%)
const REFERRAL_COMMISSION_RATE = 0.10;

// Generate unique referral code
const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'REF-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Get or create user's referral code
export const getMyReferralCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    let user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { referralCode: true },
    });

    if (!user?.referralCode) {
      // Generate new referral code
      const referralCode = generateReferralCode();
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: { referralCode },
        select: { referralCode: true },
      });
    }

    res.json({
      success: true,
      data: { referralCode: user?.referralCode },
    });
  } catch (error) {
    next(error);
  }
};

// Get referral stats
export const getReferralStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const referrals = await prisma.referral.findMany({
      where: { referrerId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    const totalReferrals = referrals.length;
    const convertedReferrals = referrals.filter(r => r.status === 'CONVERTED' || r.status === 'PAID').length;
    const pendingEarnings = referrals
      .filter(r => r.status === 'CONVERTED')
      .reduce((sum, r) => sum + Number(r.commission), 0);
    const paidEarnings = referrals
      .filter(r => r.status === 'PAID')
      .reduce((sum, r) => sum + Number(r.commission), 0);
    const clickCount = referrals.reduce((sum, r) => sum + r.clickCount, 0);
    const conversionRate = clickCount > 0 ? (convertedReferrals / clickCount) * 100 : 0;

    res.json({
      success: true,
      data: {
        stats: {
          totalReferrals,
          convertedReferrals,
          pendingEarnings,
          paidEarnings,
          clickCount,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
        referrals,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Track referral click
export const trackReferralClick = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;

    const referrer = await prisma.user.findUnique({
      where: { referralCode: code },
    });

    if (!referrer) {
      return res.json({ success: false, message: 'Invalid referral code' });
    }

    // Find or create referral tracking record
    let referral = await prisma.referral.findFirst({
      where: { referralCode: code, referredId: null },
    });

    if (!referral) {
      referral = await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referralCode: code + '-' + Date.now(),
          clickCount: 1,
        },
      });
    } else {
      await prisma.referral.update({
        where: { id: referral.id },
        data: { clickCount: { increment: 1 } },
      });
    }

    res.json({
      success: true,
      data: { referrerId: referrer.id },
    });
  } catch (error) {
    next(error);
  }
};

// Apply referral on order (called during checkout)
export const applyReferral = async (orderId: string, referralCode: string, orderTotal: number) => {
  try {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
    });

    if (!referrer) return null;

    const commission = orderTotal * REFERRAL_COMMISSION_RATE;

    const referral = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referralCode: referralCode + '-' + orderId,
        orderId,
        commission,
        status: 'CONVERTED',
        convertedAt: new Date(),
      },
    });

    return referral;
  } catch (error) {
    console.error('Referral apply error:', error);
    return null;
  }
};

