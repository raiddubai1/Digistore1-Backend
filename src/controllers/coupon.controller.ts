import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

interface CouponValidationResult {
  valid: boolean;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  discount: number;
  discountAmount: number;
  message: string;
}

// Helper to check if user/email is first-time buyer
async function isFirstTimeBuyer(userId?: string, email?: string): Promise<boolean> {
  if (!userId && !email) return true; // Assume first-time if no identifier

  const whereCondition: any = {
    status: { in: ['COMPLETED', 'PROCESSING'] },
  };

  if (userId) {
    whereCondition.customerId = userId;
  } else if (email) {
    whereCondition.OR = [
      { billingEmail: email },
      { customer: { email: email } },
    ];
  }

  const orderCount = await prisma.order.count({ where: whereCondition });
  return orderCount === 0;
}

// Validate coupon code
export const validateCoupon = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code, subtotal, email } = req.body;

    if (!code) {
      throw new AppError('Coupon code is required', 400);
    }

    const upperCode = code.toUpperCase().trim();
    const subtotalAmount = parseFloat(subtotal) || 0;

    // Find coupon in database
    const coupon = await prisma.coupon.findUnique({
      where: { code: upperCode },
    });

    if (!coupon) {
      return res.json({
        success: true,
        data: {
          valid: false,
          code: upperCode,
          message: 'Invalid coupon code',
        },
      });
    }

    // Check if coupon is active
    if (!coupon.active) {
      return res.json({
        success: true,
        data: {
          valid: false,
          code: upperCode,
          message: 'This coupon is no longer active',
        },
      });
    }

    // Check expiration
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      return res.json({
        success: true,
        data: {
          valid: false,
          code: upperCode,
          message: 'This coupon has expired',
        },
      });
    }

    // Check start date
    if (coupon.startsAt && new Date() < coupon.startsAt) {
      return res.json({
        success: true,
        data: {
          valid: false,
          code: upperCode,
          message: 'This coupon is not yet active',
        },
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.json({
        success: true,
        data: {
          valid: false,
          code: upperCode,
          message: 'This coupon has reached its usage limit',
        },
      });
    }

    // Check minimum purchase
    if (coupon.minPurchase && subtotalAmount < Number(coupon.minPurchase)) {
      return res.json({
        success: true,
        data: {
          valid: false,
          code: upperCode,
          message: `Minimum purchase of $${Number(coupon.minPurchase).toFixed(2)} required`,
        },
      });
    }

    // Check first-purchase-only restriction
    if (coupon.firstPurchaseOnly) {
      const isFirstTime = await isFirstTimeBuyer(req.user?.id, email);
      if (!isFirstTime) {
        return res.json({
          success: true,
          data: {
            valid: false,
            code: upperCode,
            message: 'This coupon is only valid for first-time buyers',
          },
        });
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discountAmount = (subtotalAmount * Number(coupon.value)) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
      }
    } else {
      discountAmount = Math.min(Number(coupon.value), subtotalAmount);
    }

    return res.json({
      success: true,
      data: {
        valid: true,
        code: upperCode,
        type: coupon.type,
        discount: Number(coupon.value),
        discountAmount: Math.round(discountAmount * 100) / 100,
        message: coupon.type === 'PERCENTAGE'
          ? `${Number(coupon.value)}% off applied!`
          : `$${Number(coupon.value).toFixed(2)} off applied!`,
      } as CouponValidationResult,
    });
  } catch (error) {
    next(error);
  }
};

// Check first-time buyer status (exported for use in payment controller)
export const checkFirstTimeBuyer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.query.email as string;
    const isFirstTime = await isFirstTimeBuyer(req.user?.id, email);

    return res.json({
      success: true,
      data: {
        isFirstTimeBuyer: isFirstTime,
        welcomeDiscount: isFirstTime ? 30 : 0, // 30% for first-time buyers
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all coupons (admin only)
export const getAllCoupons = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: { coupons },
    });
  } catch (error) {
    next(error);
  }
};

// Create coupon (admin only)
export const createCoupon = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code, type, value, minPurchase, maxDiscount, usageLimit, firstPurchaseOnly, startsAt, expiresAt } = req.body;

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase().trim(),
        type,
        value,
        minPurchase,
        maxDiscount,
        usageLimit,
        firstPurchaseOnly: firstPurchaseOnly || false,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return res.status(201).json({
      success: true,
      data: { coupon },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return next(new AppError('Coupon code already exists', 400));
    }
    next(error);
  }
};

// Update coupon (admin only)
export const updateCoupon = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, type, value, minPurchase, maxDiscount, usageLimit, firstPurchaseOnly, active, startsAt, expiresAt } = req.body;

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: code?.toUpperCase().trim(),
        type,
        value,
        minPurchase,
        maxDiscount,
        usageLimit,
        firstPurchaseOnly,
        active,
        startsAt: startsAt ? new Date(startsAt) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });

    return res.json({
      success: true,
      data: { coupon },
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return next(new AppError('Coupon not found', 404));
    }
    next(error);
  }
};

// Delete coupon (admin only)
export const deleteCoupon = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.coupon.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Coupon deleted',
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return next(new AppError('Coupon not found', 404));
    }
    next(error);
  }
};

// Export helper for use in payment controller
export { isFirstTimeBuyer };

