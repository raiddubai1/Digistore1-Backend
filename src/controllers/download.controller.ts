import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'donkzbuyp',
  api_key: '281985365816781',
  api_secret: 'mmdvkGNnW6QxzgwYGznYsvYtLws',
});

// Generate signed URL for Cloudinary raw files
function getSignedCloudinaryUrl(fileUrl: string): string {
  if (!fileUrl || !fileUrl.includes('cloudinary.com')) {
    return fileUrl;
  }

  try {
    // Extract public_id from URL
    // URL format: https://res.cloudinary.com/donkzbuyp/raw/upload/v1234567890/digistore1/downloads/filename.zip
    const urlParts = fileUrl.split('/upload/');
    if (urlParts.length < 2) return fileUrl;

    // Get the path after /upload/ (includes version and public_id)
    const pathAfterUpload = urlParts[1];
    // Remove version number if present (v1234567890/)
    const publicIdWithExt = pathAfterUpload.replace(/^v\d+\//, '');

    // Generate signed URL with 1 hour expiry
    const signedUrl = cloudinary.url(publicIdWithExt, {
      resource_type: 'raw',
      type: 'upload',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    });

    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return fileUrl;
  }
}

// Get user's downloads
export const getMyDownloads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const downloads = await prisma.download.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { downloads },
    });
  } catch (error) {
    next(error);
  }
};

export const generateDownloadLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const { orderItemId } = req.params;

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true, product: true },
    });

    if (!orderItem) throw new AppError('Order item not found', 404);
    if (orderItem.order.customerId !== req.user.id) throw new AppError('Unauthorized', 403);

    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const download = await prisma.download.create({
      data: {
        userId: req.user.id,
        productId: orderItem.productId,
        orderId: orderItem.orderId,
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

    // Redirect to the actual file URL for download
    const fileUrl = download.product.fileUrl;
    if (fileUrl) {
      // Generate signed URL for Cloudinary raw files
      const signedUrl = getSignedCloudinaryUrl(fileUrl);
      return res.redirect(signedUrl);
    }

    throw new AppError('File not available', 404);
  } catch (error) {
    next(error);
  }
};

