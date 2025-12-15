import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendNewsletterWelcome, sendPromotionalEmail } from '../services/newsletter.service';
import { AuthRequest } from '../middleware/auth';

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

// Send promotional email to all subscribers (admin only)
export const sendPromotion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const { subject, title, body, ctaText, ctaUrl } = req.body;

    if (!subject || !title || !body) {
      throw new AppError('Subject, title, and body are required', 400);
    }

    // Get all subscribers
    const subscribers = await prisma.setting.findMany({
      where: { key: { startsWith: 'newsletter_' } },
    });

    const emails = subscribers.map((s) => {
      try {
        const data = JSON.parse(s.value);
        return data.email;
      } catch {
        return s.key.replace('newsletter_', '');
      }
    }).filter(Boolean);

    if (emails.length === 0) {
      throw new AppError('No subscribers found', 400);
    }

    // Send promotional emails
    await sendPromotionalEmail(emails, subject, title, body, ctaText, ctaUrl);

    res.json({
      success: true,
      message: `Promotional email sent to ${emails.length} subscribers`,
      data: { recipientCount: emails.length },
    });
  } catch (error) {
    next(error);
  }
};

