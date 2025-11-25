import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { productId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { reviews } });
  } catch (error) {
    next(error);
  }
};

export const createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { productId, rating, title, comment } = req.body;
    const review = await prisma.review.create({
      data: { productId, userId: req.user.id, rating, title, comment },
    });
    res.status(201).json({ success: true, data: { review } });
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { id } = req.params;
    const review = await prisma.review.update({ where: { id }, data: req.body });
    res.json({ success: true, data: { review } });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { id } = req.params;
    await prisma.review.delete({ where: { id } });
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    next(error);
  }
};

