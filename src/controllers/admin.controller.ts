import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { getSignedDownloadUrl, getS3KeyFromUrl } from '../config/s3';

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
      subcategory,
      tags,
      fileType,
      fileSize,
      fileUrl,
      fileName,
      thumbnailUrl,
      previewImages,
      whatsIncluded,
      requirements,
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
        subcategory,
        tags: tags || [],
        fileType,
        fileSize: fileSize ? BigInt(fileSize) : null,
        fileUrl,
        fileName,
        thumbnailUrl,
        previewImages: previewImages || [],
        whatsIncluded: whatsIncluded || [],
        requirements: requirements || [],
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

    // Delete all categories
    await prisma.category.deleteMany({});

    // Delete all attributes
    await prisma.attribute.deleteMany({});

    res.json({
      success: true,
      message: `Deleted ${result.count} products, all categories, and all related data`,
      data: { deletedCount: result.count },
    });
  } catch (error) {
    next(error);
  }
};

// TEMPORARY: Public endpoint for bulk product import - uses admin secret
export const createProductPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Security: require admin secret
    const secret = req.headers['x-admin-secret'] || req.query.secret;
    if (secret !== 'cleanup-digistore1-2024') {
      throw new AppError('Invalid admin secret', 403);
    }

    const {
      title,
      description,
      shortDescription,
      price,
      originalPrice,
      categoryId,
      categoryName,
      subcategory,
      tags,
      fileType,
      fileSize,
      fileUrl,
      fileName,
      thumbnailUrl,
      previewImages,
      whatsIncluded,
      requirements,
    } = req.body;

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Get or create category
    let finalCategoryId = categoryId;
    if (categoryName && !categoryId) {
      const catSlug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let category = await prisma.category.findFirst({ where: { slug: catSlug } });
      if (!category) {
        category = await prisma.category.create({
          data: {
            name: categoryName,
            slug: catSlug,
            description: `${categoryName} digital products`,
          },
        });
      }
      finalCategoryId = category.id;
    } else if (categoryId) {
      // Check if category exists, if not create a placeholder
      const existingCat = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!existingCat) {
        const newCat = await prisma.category.create({
          data: {
            name: 'Pets & Animals',
            slug: 'pets-animals',
            description: 'Pets & Animals digital products',
          },
        });
        finalCategoryId = newCat.id;
      }
    }

    // Check if slug already exists
    const existingProduct = await prisma.product.findUnique({
      where: { slug },
    });

    if (existingProduct) {
      throw new AppError('A product with this title already exists', 400);
    }

    // Get admin user
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) {
      throw new AppError('No admin user found', 500);
    }

    // Get or create a default vendor profile for admin imports
    let defaultVendor = await prisma.vendorProfile.findFirst({
      where: { userId: adminUser.id },
    });

    if (!defaultVendor) {
      defaultVendor = await prisma.vendorProfile.create({
        data: {
          userId: adminUser.id,
          businessName: 'DigiStore Official',
          businessEmail: 'admin@digistore1.com',
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
        categoryId: finalCategoryId,
        subcategory,
        tags: tags || [],
        fileType,
        fileSize: fileSize ? BigInt(fileSize) : null,
        fileUrl,
        fileName,
        thumbnailUrl,
        previewImages: previewImages || [],
        whatsIncluded: whatsIncluded || [],
        requirements: requirements || [],
        vendorId: defaultVendor.id,
        status: 'APPROVED' as any,
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

// Stream download file through backend - supports S3 files
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

    // Check if it's an S3 URL
    const s3Key = getS3KeyFromUrl(product.fileUrl);
    let downloadUrl: string;

    if (s3Key) {
      // Generate S3 signed URL
      downloadUrl = await getSignedDownloadUrl(s3Key, fileName, 3600);
      console.log('Downloading from S3 signed URL');
    } else {
      // Fallback to original URL (for legacy Cloudinary files)
      downloadUrl = product.fileUrl;
      console.log('Downloading from original URL:', downloadUrl);
    }

    // Fetch the file
    const response = await axios({
      method: 'get',
      url: downloadUrl,
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

// Update product thumbnail by slug (for bulk cover extraction)
export const updateProductThumbnail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (secret !== 'cleanup-digistore1-2024') {
      throw new AppError('Unauthorized', 401);
    }

    const { slug, thumbnailUrl, price, categoryId } = req.body;

    if (!slug) {
      throw new AppError('slug is required', 400);
    }

    if (thumbnailUrl === undefined && price === undefined && categoryId === undefined) {
      throw new AppError('thumbnailUrl, price, or categoryId is required', 400);
    }

    const product = await prisma.product.findFirst({
      where: { slug },
    });

    if (!product) {
      throw new AppError(`Product with slug "${slug}" not found`, 404);
    }

    const updateData: { thumbnailUrl?: string; price?: number; categoryId?: string } = {};
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    if (price !== undefined) updateData.price = price;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: updateData,
    });

    res.json({
      success: true,
      data: { product: { id: updated.id, slug: updated.slug, thumbnailUrl: updated.thumbnailUrl, price: updated.price } },
    });
  } catch (error) {
    next(error);
  }
};

// Upload image to Cloudinary (public endpoint for migration)
import streamifier from 'streamifier';

export const uploadImagePublic = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'digistore1/dog-ebooks',
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      streamifier.createReadStream(req.file!.buffer).pipe(uploadStream);
    });

    res.json({
      success: true,
      data: {
        url: (result as any).secure_url,
        publicId: (result as any).public_id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete a category by ID (admin only - for reorganization)
export const deleteCategoryPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (secret !== 'cleanup-digistore1-2024') {
      throw new AppError('Unauthorized', 401);
    }

    const { categoryId } = req.params;

    if (!categoryId) {
      throw new AppError('categoryId is required', 400);
    }

    // Check if category has products
    const productsCount = await prisma.product.count({
      where: { categoryId },
    });

    if (productsCount > 0) {
      throw new AppError(`Cannot delete category with ${productsCount} products. Move products first.`, 400);
    }

    // Check if category has children
    const childrenCount = await prisma.category.count({
      where: { parentId: categoryId },
    });

    if (childrenCount > 0) {
      throw new AppError(`Cannot delete category with ${childrenCount} subcategories. Delete subcategories first.`, 400);
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Create a category with optional parent (for reorganization)
export const createCategoryPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (secret !== 'cleanup-digistore1-2024') {
      throw new AppError('Unauthorized', 401);
    }

    const { name, parentId, icon, description } = req.body;

    if (!name) {
      throw new AppError('name is required', 400);
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Check if category with same slug exists
    const existing = await prisma.category.findFirst({
      where: { slug },
    });

    if (existing) {
      // Return existing category
      return res.json({
        success: true,
        data: { category: existing, existed: true },
      });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        parentId: parentId || null,
        icon: icon || null,
        description: description || null,
        active: true,
      },
    });

    res.json({
      success: true,
      data: { category, existed: false },
    });
  } catch (error) {
    next(error);
  }
};

// Delete a product by slug (for cleanup)
export const deleteProductPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (secret !== 'cleanup-digistore1-2024') {
      throw new AppError('Unauthorized', 401);
    }

    const { slug } = req.params;

    const product = await prisma.product.findFirst({
      where: { slug },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    await prisma.product.delete({
      where: { id: product.id },
    });

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Delete all products in a category (for category cleanup)
export const deleteProductsByCategoryPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (secret !== 'cleanup-digistore1-2024') {
      throw new AppError('Unauthorized', 401);
    }

    const { categoryId } = req.params;

    if (!categoryId) {
      throw new AppError('categoryId is required', 400);
    }

    // Delete related records first to avoid foreign key constraints
    const products = await prisma.product.findMany({
      where: { categoryId },
      select: { id: true, title: true },
    });

    if (products.length === 0) {
      return res.json({
        success: true,
        message: 'No products found in this category',
        deletedCount: 0,
      });
    }

    const productIds = products.map(p => p.id);

    // Delete related records
    await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.productAttribute.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.download.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.review.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.wishlist.deleteMany({ where: { productId: { in: productIds } } });

    // Delete products
    const result = await prisma.product.deleteMany({
      where: { categoryId },
    });

    res.json({
      success: true,
      message: `Deleted ${result.count} products from category`,
      deletedCount: result.count,
      deletedProducts: products.map(p => p.title),
    });
  } catch (error) {
    next(error);
  }
};

// Move all products from one category to another
export const moveProductsBetweenCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (secret !== 'cleanup-digistore1-2024') {
      throw new AppError('Unauthorized', 401);
    }

    const { fromCategoryId, toCategoryId } = req.body;

    if (!fromCategoryId || !toCategoryId) {
      throw new AppError('fromCategoryId and toCategoryId are required', 400);
    }

    // Verify both categories exist
    const [fromCat, toCat] = await Promise.all([
      prisma.category.findUnique({ where: { id: fromCategoryId } }),
      prisma.category.findUnique({ where: { id: toCategoryId } }),
    ]);

    if (!fromCat) {
      throw new AppError('Source category not found', 404);
    }
    if (!toCat) {
      throw new AppError('Destination category not found', 404);
    }

    // Get products to move
    const products = await prisma.product.findMany({
      where: { categoryId: fromCategoryId },
      select: { id: true, title: true },
    });

    if (products.length === 0) {
      return res.json({
        success: true,
        message: 'No products to move',
        movedCount: 0,
      });
    }

    // Move products
    const result = await prisma.product.updateMany({
      where: { categoryId: fromCategoryId },
      data: { categoryId: toCategoryId },
    });

    res.json({
      success: true,
      message: `Moved ${result.count} products from "${fromCat.name}" to "${toCat.name}"`,
      movedCount: result.count,
      movedProducts: products.map(p => p.title),
    });
  } catch (error) {
    next(error);
  }
};

// Force delete a category (including children and products)
export const forceDeleteCategoryPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (secret !== 'cleanup-digistore1-2024') {
      throw new AppError('Unauthorized', 401);
    }

    const { categoryId } = req.params;

    if (!categoryId) {
      throw new AppError('categoryId is required', 400);
    }

    // Get all descendant categories recursively
    const getAllDescendants = async (parentId: string): Promise<string[]> => {
      const children = await prisma.category.findMany({
        where: { parentId },
        select: { id: true },
      });

      const allIds: string[] = [];
      for (const child of children) {
        allIds.push(child.id);
        const descendants = await getAllDescendants(child.id);
        allIds.push(...descendants);
      }
      return allIds;
    };

    const descendantIds = await getAllDescendants(categoryId);
    const allCategoryIds = [categoryId, ...descendantIds];

    // Get all products in these categories
    const products = await prisma.product.findMany({
      where: { categoryId: { in: allCategoryIds } },
      select: { id: true },
    });
    const productIds = products.map(p => p.id);

    let deletedProductsCount = 0;
    if (productIds.length > 0) {
      // Delete related records
      await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.productAttribute.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.download.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.review.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.wishlist.deleteMany({ where: { productId: { in: productIds } } });

      // Delete products
      const result = await prisma.product.deleteMany({
        where: { categoryId: { in: allCategoryIds } },
      });
      deletedProductsCount = result.count;
    }

    // Delete categories (children first, then parent)
    let deletedCategoriesCount = 0;
    for (const catId of [...descendantIds.reverse(), categoryId]) {
      await prisma.category.delete({ where: { id: catId } });
      deletedCategoriesCount++;
    }

    res.json({
      success: true,
      message: `Force deleted category and all descendants`,
      deletedCategoriesCount,
      deletedProductsCount,
    });
  } catch (error) {
    next(error);
  }
};
