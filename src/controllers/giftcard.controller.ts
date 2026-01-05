import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { createPayPalOrder, capturePayPalPayment } from '../config/paypal';
import { GiftCardStatus } from '@prisma/client';
import { sendGiftCardEmail } from '../services/email.service';
import crypto from 'crypto';

// Generate unique gift card code (GC-XXXX-XXXX-XXXX)
function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, 1, I)
  const segments = [];
  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return `GC-${segments.join('-')}`;
}

// Create PayPal order for gift card purchase
export const createGiftCardOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, recipientEmail, recipientName, personalMessage, purchaserEmail, purchaserName } = req.body;

    // Validate amount
    const validAmounts = [10, 25, 50, 75, 100, 150, 200, 250];
    if (!validAmounts.includes(amount)) {
      throw new AppError(`Invalid gift card amount. Valid amounts: ${validAmounts.join(', ')}`, 400);
    }

    if (!recipientEmail || !recipientName) {
      throw new AppError('Recipient email and name are required', 400);
    }

    const emailToUse = purchaserEmail || req.user?.email;
    if (!emailToUse) {
      throw new AppError('Purchaser email is required', 400);
    }

    // Generate unique code
    let code = generateGiftCardCode();
    let attempts = 0;
    while (await prisma.giftCard.findUnique({ where: { code } })) {
      code = generateGiftCardCode();
      attempts++;
      if (attempts > 10) throw new AppError('Failed to generate unique code', 500);
    }

    // Create pending gift card record
    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        amount,
        balance: amount,
        status: GiftCardStatus.PENDING,
        purchaserEmail: emailToUse,
        purchaserName: purchaserName || 'Anonymous',
        recipientEmail,
        recipientName,
        personalMessage: personalMessage || null,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      },
    });

    // Create PayPal order
    const paypalOrder = await createPayPalOrder(amount, 'USD', [
      {
        name: `Digistore1 Gift Card - $${amount}`,
        quantity: 1,
        unit_amount: amount,
      },
    ]);

    // Store PayPal order ID
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { paypalOrderId: paypalOrder.id },
    });

    res.json({
      success: true,
      data: {
        giftCardId: giftCard.id,
        paypalOrderId: paypalOrder.id,
        approvalUrl: paypalOrder.links.find((link: any) => link.rel === 'approve')?.href,
      },
    });
  } catch (error: any) {
    console.error('Gift card order creation error:', error);
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to create gift card order', 500));
    }
  }
};

// Capture PayPal payment and activate gift card
export const captureGiftCardPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paypalOrderId, giftCardId } = req.body;

    if (!paypalOrderId || !giftCardId) {
      throw new AppError('PayPal order ID and gift card ID are required', 400);
    }

    // Find the gift card
    const giftCard = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
    if (!giftCard) {
      throw new AppError('Gift card not found', 404);
    }

    if (giftCard.status !== GiftCardStatus.PENDING) {
      throw new AppError('Gift card is not in pending status', 400);
    }

    if (giftCard.paypalOrderId !== paypalOrderId) {
      throw new AppError('PayPal order ID mismatch', 400);
    }

    // Capture the payment
    const captureData = await capturePayPalPayment(paypalOrderId);

    if (captureData.status !== 'COMPLETED') {
      throw new AppError('Payment was not completed', 400);
    }

    // Activate the gift card
    const updatedGiftCard = await prisma.giftCard.update({
      where: { id: giftCardId },
      data: {
        status: GiftCardStatus.ACTIVE,
        purchasedAt: new Date(),
      },
    });

    // Send gift card email to recipient
    try {
      await sendGiftCardEmail(
        updatedGiftCard.recipientEmail,
        updatedGiftCard.recipientName,
        {
          code: updatedGiftCard.code,
          amount: Number(updatedGiftCard.amount),
          purchaserName: updatedGiftCard.purchaserName || 'Someone special',
          personalMessage: updatedGiftCard.personalMessage || undefined,
          expiresAt: updatedGiftCard.expiresAt || undefined,
        }
      );

      await prisma.giftCard.update({
        where: { id: giftCardId },
        data: { emailSentAt: new Date() },
      });
    } catch (emailError) {
      console.error('Failed to send gift card email:', emailError);
      // Don't fail the transaction, email can be resent
    }

    res.json({
      success: true,
      data: {
        message: 'Gift card purchased successfully!',
        giftCard: {
          id: updatedGiftCard.id,
          code: updatedGiftCard.code,
          amount: Number(updatedGiftCard.amount),
          recipientEmail: updatedGiftCard.recipientEmail,
          recipientName: updatedGiftCard.recipientName,
        },
      },
    });
  } catch (error: any) {
    console.error('Gift card capture error:', error);
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to capture gift card payment', 500));
    }
  }
};

// Validate gift card code and check balance
export const validateGiftCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;

    if (!code) {
      throw new AppError('Gift card code is required', 400);
    }

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!giftCard) {
      throw new AppError('Invalid gift card code', 404);
    }

    // Check status
    if (giftCard.status === GiftCardStatus.PENDING) {
      throw new AppError('This gift card has not been activated yet', 400);
    }

    if (giftCard.status === GiftCardStatus.REDEEMED) {
      throw new AppError('This gift card has been fully redeemed', 400);
    }

    if (giftCard.status === GiftCardStatus.EXPIRED) {
      throw new AppError('This gift card has expired', 400);
    }

    if (giftCard.status === GiftCardStatus.CANCELLED) {
      throw new AppError('This gift card has been cancelled', 400);
    }

    // Check expiry
    if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
      await prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { status: GiftCardStatus.EXPIRED },
      });
      throw new AppError('This gift card has expired', 400);
    }

    res.json({
      success: true,
      data: {
        valid: true,
        balance: Number(giftCard.balance),
        originalAmount: Number(giftCard.amount),
        expiresAt: giftCard.expiresAt,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to validate gift card', 500));
    }
  }
};

// Apply gift card to order (reduce balance)
export const applyGiftCard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code, orderTotal, orderId } = req.body;

    if (!code || orderTotal === undefined) {
      throw new AppError('Gift card code and order total are required', 400);
    }

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!giftCard || giftCard.status !== GiftCardStatus.ACTIVE) {
      throw new AppError('Invalid or inactive gift card', 400);
    }

    // Check expiry
    if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
      await prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { status: GiftCardStatus.EXPIRED },
      });
      throw new AppError('This gift card has expired', 400);
    }

    const balance = Number(giftCard.balance);
    const amountToApply = Math.min(balance, orderTotal);
    const newBalance = balance - amountToApply;

    // Update gift card balance
    const updatedGiftCard = await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        balance: newBalance,
        status: newBalance === 0 ? GiftCardStatus.REDEEMED : GiftCardStatus.ACTIVE,
        redeemedAt: newBalance === 0 ? new Date() : null,
        redeemedById: req.user?.id || null,
      },
    });

    // Record usage
    await prisma.giftCardUsage.create({
      data: {
        giftCardId: giftCard.id,
        orderId: orderId || null,
        amount: amountToApply,
      },
    });

    res.json({
      success: true,
      data: {
        amountApplied: amountToApply,
        remainingBalance: newBalance,
        newOrderTotal: orderTotal - amountToApply,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to apply gift card', 500));
    }
  }
};

// Check gift card balance (public endpoint)
export const checkBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;

    if (!code) {
      throw new AppError('Gift card code is required', 400);
    }

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: {
        usages: {
          orderBy: { usedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!giftCard) {
      throw new AppError('Gift card not found', 404);
    }

    res.json({
      success: true,
      data: {
        code: giftCard.code,
        originalAmount: Number(giftCard.amount),
        balance: Number(giftCard.balance),
        status: giftCard.status,
        expiresAt: giftCard.expiresAt,
        recentUsages: giftCard.usages.map(u => ({
          amount: Number(u.amount),
          usedAt: u.usedAt,
        })),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to check balance', 500));
    }
  }
};

// Resend gift card email (for purchaser)
export const resendGiftCardEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { giftCardId } = req.params;

    const giftCard = await prisma.giftCard.findUnique({
      where: { id: giftCardId },
    });

    if (!giftCard) {
      throw new AppError('Gift card not found', 404);
    }

    // Only allow purchaser or admin to resend
    if (req.user?.email !== giftCard.purchaserEmail && req.user?.role !== 'ADMIN') {
      throw new AppError('Not authorized to resend this gift card', 403);
    }

    if (giftCard.status !== GiftCardStatus.ACTIVE) {
      throw new AppError('Can only resend active gift cards', 400);
    }

    await sendGiftCardEmail(
      giftCard.recipientEmail,
      giftCard.recipientName,
      {
        code: giftCard.code,
        amount: Number(giftCard.amount),
        purchaserName: giftCard.purchaserName || 'Someone special',
        personalMessage: giftCard.personalMessage || undefined,
        expiresAt: giftCard.expiresAt || undefined,
      }
    );

    await prisma.giftCard.update({
      where: { id: giftCardId },
      data: { emailSentAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Gift card email resent successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to resend gift card email', 500));
    }
  }
};

// Get user's purchased gift cards
export const getMyGiftCards = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const giftCards = await prisma.giftCard.findMany({
      where: {
        purchaserEmail: req.user.email,
        status: { not: GiftCardStatus.PENDING },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: giftCards.map(gc => ({
        id: gc.id,
        code: gc.code,
        amount: Number(gc.amount),
        balance: Number(gc.balance),
        status: gc.status,
        recipientEmail: gc.recipientEmail,
        recipientName: gc.recipientName,
        purchasedAt: gc.purchasedAt,
        expiresAt: gc.expiresAt,
        emailSentAt: gc.emailSentAt,
      })),
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to get gift cards', 500));
    }
  }
};

