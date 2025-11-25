import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const user = await prisma.user.update({ where: { id: req.user.id }, data: req.body });
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const getWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const wishlist = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: { product: true },
    });
    res.json({ success: true, data: { wishlist } });
  } catch (error) {
    next(error);
  }
};

export const addToWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { productId } = req.params;
    const wishlistItem = await prisma.wishlist.create({
      data: { userId: req.user.id, productId },
    });
    res.json({ success: true, data: { wishlistItem } });
  } catch (error) {
    next(error);
  }
};

export const removeFromWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { productId } = req.params;
    await prisma.wishlist.delete({
      where: { userId_productId: { userId: req.user.id, productId } },
    });
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    next(error);
  }
};

export const getDownloads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const downloads = await prisma.download.findMany({
      where: { userId: req.user.id },
      include: { product: true },
    });
    res.json({ success: true, data: { downloads } });
  } catch (error) {
    next(error);
  }
};

