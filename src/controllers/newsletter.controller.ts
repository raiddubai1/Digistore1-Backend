import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendNewsletterWelcome } from '../services/newsletter.service';

// Subscribe to newsletter
export const subscribe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    // Check if already subscribed
    const existing = await prisma.setting.findUnique({
      where: { key: `newsletter_${email}` },
    });

    if (existing) {
      return res.json({
        success: true,
        message: 'Already subscribed to newsletter',
      });
    }

    // Save subscription
    await prisma.setting.create({
      data: {
        key: `newsletter_${email}`,
        value: JSON.stringify({ email, name, subscribedAt: new Date() }),
        description: 'Newsletter subscriber',
      },
    });

    // Send welcome email
    try {
      await sendNewsletterWelcome(email, name || 'Subscriber');
    } catch (emailError) {
      console.error('Newsletter welcome email failed:', emailError);
    }

    res.json({
      success: true,
      message: 'Successfully subscribed to newsletter!',
    });
  } catch (error) {
    next(error);
  }
};

// Unsubscribe from newsletter
export const unsubscribe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    await prisma.setting.deleteMany({
      where: { key: `newsletter_${email}` },
    });

    res.json({
      success: true,
      message: 'Successfully unsubscribed from newsletter',
    });
  } catch (error) {
    next(error);
  }
};

// Get all subscribers (admin only)
export const getSubscribers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscribers = await prisma.setting.findMany({
      where: { key: { startsWith: 'newsletter_' } },
    });

    const parsedSubscribers = subscribers.map((s) => {
      try {
        return JSON.parse(s.value);
      } catch {
        return { email: s.key.replace('newsletter_', '') };
      }
    });

    res.json({
      success: true,
      data: { subscribers: parsedSubscribers, total: parsedSubscribers.length },
    });
  } catch (error) {
    next(error);
  }
};

