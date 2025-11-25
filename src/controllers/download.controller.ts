import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

export const generateDownloadLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);
    
    const { orderItemId } = req.params;
    
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true, product: true },
    });

    if (!orderItem) throw new AppError('Order item not found', 404);
    if (orderItem.order.userId !== req.user.id) throw new AppError('Unauthorized', 403);

    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const download = await prisma.download.create({
      data: {
        userId: req.user.id,
        productId: orderItem.productId,
        orderItemId: orderItem.id,
        downloadToken,
        expiresAt,
      },
    });

    res.json({
      success: true,
      data: {
        downloadUrl: `${process.env.FRONTEND_URL}/api/downloads/${downloadToken}`,
        expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const downloadFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    const download = await prisma.download.findUnique({
      where: { downloadToken: token },
      include: { product: true },
    });

    if (!download) throw new AppError('Invalid download link', 404);
    if (download.expiresAt < new Date()) throw new AppError('Download link expired', 410);
    if (download.downloadCount >= download.maxDownloads) {
      throw new AppError('Maximum downloads exceeded', 403);
    }

    await prisma.download.update({
      where: { id: download.id },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: { fileUrl: download.product.fileUrl },
    });
  } catch (error) {
    next(error);
  }
};

