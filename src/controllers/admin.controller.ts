import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Get dashboard stats
export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    // Get counts
    const [totalOrders, totalProducts, totalCustomers] = await Promise.all([
      prisma.order.count(),
      prisma.product.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
    ]);

    // Get total revenue
    const revenueResult = await prisma.order.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { total: true },
    });
    const totalRevenue = Number(revenueResult._sum.total || 0);

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { name: true, email: true },
        },
      },
    });

    // Get top products by sales
    const topProductsData = await prisma.orderItem.groupBy({
      by: ['productId'],
      _count: { productId: true },
      _sum: { price: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 5,
    });

    // Get product details for top products
    const productIds = topProductsData.map(p => p.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true },
    });

    const topProducts = topProductsData.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        id: item.productId,
        title: product?.title || 'Unknown Product',
        sales: item._count.productId,
        revenue: Number(item._sum.price || 0),
      };
    });

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalCustomers,
        recentOrders,
        topProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all orders (admin)
export const getAllOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true } },
          orderItems: {
            include: { product: { select: { title: true } } },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all customers (admin)
export const getAllCustomers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { role: 'CUSTOMER' };

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          _count: { select: { orders: true } },
          orders: {
            select: { total: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Calculate stats
    const activeCount = await prisma.user.count({ where: { role: 'CUSTOMER', status: 'ACTIVE' } });
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const newThisMonth = await prisma.user.count({
      where: { role: 'CUSTOMER', createdAt: { gte: thisMonth } },
    });

    // Calculate total spent for each customer and clean up response
    const customersWithStats = customers.map(customer => {
      const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.total), 0);
      const lastPurchase = customer.orders[0]?.createdAt || null;
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        status: customer.status,
        createdAt: customer.createdAt,
        totalSpent,
        lastPurchase,
        totalOrders: customer._count.orders,
      };
    });

    res.json({
      success: true,
      data: {
        customers: customersWithStats,
        stats: {
          total,
          active: activeCount,
          newThisMonth,
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all vendors (admin)
export const getAllVendors = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { role: 'VENDOR' };

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
        { vendorProfile: { businessName: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [vendors, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          vendorProfile: {
            select: {
              id: true,
              businessName: true,
              businessEmail: true,
              totalEarnings: true,
              currentBalance: true,
              _count: { select: { products: true } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Calculate stats
    const activeCount = await prisma.user.count({ where: { role: 'VENDOR', status: 'ACTIVE' } });
    const pendingCount = await prisma.user.count({ where: { role: 'VENDOR', status: 'PENDING' } });

    res.json({
      success: true,
      data: {
        vendors,
        stats: {
          total,
          active: activeCount,
          pending: pendingCount,
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update user status (admin)
export const updateUserStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const { userId } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, name: true, email: true, status: true },
    });

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Get all reviews (admin)
export const getAllReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const { page = 1, limit = 20, verified } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (verified === 'true') where.verified = true;
    if (verified === 'false') where.verified = false;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, title: true, slug: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    // Calculate stats
    const [totalReviews, verifiedCount, avgRating] = await Promise.all([
      prisma.review.count(),
      prisma.review.count({ where: { verified: true } }),
      prisma.review.aggregate({ _avg: { rating: true } }),
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        stats: {
          total: totalReviews,
          verified: verifiedCount,
          unverified: totalReviews - verifiedCount,
          avgRating: avgRating._avg.rating || 0,
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete review (admin)
export const deleteReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const { reviewId } = req.params;

    await prisma.review.delete({ where: { id: reviewId } });

    res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Toggle review verified status (admin)
export const toggleReviewVerified = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const { reviewId } = req.params;

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError('Review not found', 404);

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { verified: !review.verified },
    });

    res.json({
      success: true,
      data: { review: updated },
    });
  } catch (error) {
    next(error);
  }
};

// Create product (admin) - for bulk imports without needing vendor profile
export const createProductAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const {
      title,
      description,
      shortDescription,
      price,
      originalPrice,
      categoryId,
      fileType,
      fileSize,
      fileUrl,
      fileName,
      thumbnailUrl,
      previewImages,
      status = 'APPROVED',
    } = req.body;

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existingProduct = await prisma.product.findUnique({
      where: { slug },
    });

    if (existingProduct) {
      throw new AppError('A product with this title already exists', 400);
    }

    // Get or create a default vendor profile for admin imports
    let defaultVendor = await prisma.vendorProfile.findFirst({
      where: { businessName: 'DigiStore Official' },
    });

    if (!defaultVendor) {
      // Create a vendor profile for the admin user
      defaultVendor = await prisma.vendorProfile.create({
        data: {
          userId: req.user.id,
          businessName: 'DigiStore Official',
          businessEmail: req.user.email || 'admin@digistore1.com',
          description: 'Official DigiStore store products',
          verified: true,
          autoApproveProducts: true,
        },
      });
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        title,
        slug,
        description,
        shortDescription,
        price,
        originalPrice: originalPrice || price,
        discount: originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
        categoryId,
        fileType,
        fileSize: fileSize ? BigInt(fileSize) : null,
        fileUrl,
        fileName,
        thumbnailUrl,
        previewImages: previewImages || [],
        vendorId: defaultVendor.id,
        status: status as any,
        featured: false,
        bestseller: false,
        newArrival: true,
      },
      include: {
        category: true,
      },
    });

    res.status(201).json({
      success: true,
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// Bulk delete all products (admin only)
export const deleteAllProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    // Delete all order items first (foreign key constraint)
    await prisma.orderItem.deleteMany({});

    // Delete all product attributes
    await prisma.productAttribute.deleteMany({});

    // Delete all downloads
    await prisma.download.deleteMany({});

    // Delete all reviews
    await prisma.review.deleteMany({});

    // Delete all wishlists
    await prisma.wishlist.deleteMany({});

    // Now delete all products
    const result = await prisma.product.deleteMany({});

    res.json({
      success: true,
      message: `Deleted ${result.count} products and all related data`,
      data: { deletedCount: result.count },
    });
  } catch (error) {
    next(error);
  }
};

// TEMPORARY: Public endpoint for cleanup - REMOVE AFTER USE
import { Request } from 'express';
export const deleteAllProductsPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Security: require a secret key
    const secret = req.headers['x-cleanup-secret'] || req.query.secret;
    if (secret !== 'cleanup-digistore1-2024') {
      throw new AppError('Invalid cleanup secret', 403);
    }

    // Delete all order items first (foreign key constraint)
    await prisma.orderItem.deleteMany({});

    // Delete all product attributes
    await prisma.productAttribute.deleteMany({});

    // Delete all downloads
    await prisma.download.deleteMany({});

    // Delete all reviews
    await prisma.review.deleteMany({});

    // Delete all wishlists
    await prisma.wishlist.deleteMany({});

    // Now delete all products
    const result = await prisma.product.deleteMany({});

    res.json({
      success: true,
      message: `Deleted ${result.count} products and all related data`,
      data: { deletedCount: result.count },
    });
  } catch (error) {
    next(error);
  }
};

// Get signed download URL for a product (for admin testing)
import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';

// Configure Cloudinary
const CLOUD_NAME = 'donkzbuyp';
const API_KEY = '281985365816781';
const API_SECRET = 'mmdvkGNnW6QxzgwYGznYsvYtLws';

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

// Stream download file through backend using Cloudinary API
export const streamDownloadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { fileUrl: true, fileName: true, fileType: true },
    });

    if (!product || !product.fileUrl) {
      throw new AppError('Product or file not found', 404);
    }

    // Get file extension from URL
    const urlPath = new URL(product.fileUrl).pathname;
    const ext = urlPath.split('.').pop() || product.fileType || 'zip';
    const safeFileName = (product.fileName || 'download').replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `${safeFileName}.${ext}`;

    // Extract public_id from Cloudinary URL (keep full path with extension for raw)
    // URL format: https://res.cloudinary.com/cloud/raw/upload/v123/folder/file.ext
    const match = product.fileUrl.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) {
      throw new AppError('Invalid file URL format', 400);
    }
    const publicId = match[1];

    // Generate signed URL using Cloudinary SDK
    const signedUrl = cloudinary.url(publicId, {
      resource_type: 'raw',
      type: 'upload',
      sign_url: true,
      secure: true,
    });

    console.log('Downloading from signed URL:', signedUrl);

    // Fetch using signed URL
    const response = await axios({
      method: 'get',
      url: signedUrl,
      responseType: 'stream',
      timeout: 120000, // 2 min timeout for large files
    });

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Pipe the response
    response.data.pipe(res);
  } catch (error: any) {
    console.error('Download error:', error.response?.status, error.response?.data, error.message);
    next(new AppError('Failed to download file', 500));
  }
};
