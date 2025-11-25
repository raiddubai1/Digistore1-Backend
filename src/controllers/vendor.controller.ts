import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Get dashboard stats
export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendorProfile) throw new AppError('Vendor profile not found', 404);

    const [totalProducts, totalSales, pendingProducts] = await Promise.all([
      prisma.product.count({ where: { vendorId: vendorProfile.id } }),
      prisma.orderItem.count({ where: { vendorId: vendorProfile.id } }),
      prisma.product.count({ where: { vendorId: vendorProfile.id, status: 'PENDING_REVIEW' } }),
    ]);

    res.json({
      success: true,
      data: {
        totalProducts,
        totalSales,
        pendingProducts,
        totalRevenue: vendorProfile.totalRevenue,
        availableBalance: vendorProfile.availableBalance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get vendor's products
export const getVendorProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendorProfile) throw new AppError('Vendor profile not found', 404);

    const products = await prisma.product.findMany({
      where: { vendorId: vendorProfile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        _count: {
          select: { reviews: true, orderItems: true },
        },
      },
    });

    res.json({
      success: true,
      data: { products },
    });
  } catch (error) {
    next(error);
  }
};

// Get sales
export const getSales = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { sales: [] } });
  } catch (error) {
    next(error);
  }
};

// Get revenue
export const getRevenue = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { revenue: [] } });
  } catch (error) {
    next(error);
  }
};

// Get payouts
export const getPayouts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { payouts: [] } });
  } catch (error) {
    next(error);
  }
};

// Request payout
export const requestPayout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, message: 'Payout requested' });
  } catch (error) {
    next(error);
  }
};

// Get profile
export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: true },
    });

    res.json({ success: true, data: { profile: vendorProfile } });
  } catch (error) {
    next(error);
  }
};

// Update profile
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const vendorProfile = await prisma.vendorProfile.update({
      where: { userId: req.user.id },
      data: req.body,
    });

    res.json({ success: true, data: { profile: vendorProfile } });
  } catch (error) {
    next(error);
  }
};

