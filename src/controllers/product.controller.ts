import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Prisma, ProductStatus } from '@prisma/client';

// Get all products with filtering, search, and pagination
export const getAllProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      priceMin,
      priceMax,
      rating,
      fileType,
      sort = 'newest',
      featured,
      bestseller,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.APPROVED,
    };

    if (category) {
      where.category = {
        slug: category as string,
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { tags: { has: search as string } },
      ];
    }

    if (priceMin || priceMax) {
      where.price = {};
      if (priceMin) where.price.gte = Number(priceMin);
      if (priceMax) where.price.lte = Number(priceMax);
    }

    if (rating) {
      where.rating = { gte: Number(rating) };
    }

    if (fileType) {
      where.fileType = fileType as string;
    }

    if (featured === 'true') {
      where.featured = true;
    }

    if (bestseller === 'true') {
      where.bestseller = true;
    }

    // Build orderBy clause
    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    
    switch (sort) {
      case 'price-low':
        orderBy = { price: 'asc' };
        break;
      case 'price-high':
        orderBy = { price: 'desc' };
        break;
      case 'popular':
        orderBy = { downloadCount: 'desc' };
        break;
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    // Get products
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('getAllProducts error:', error);
    next(error);
  }
};

// Get featured products
export const getFeaturedProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: ProductStatus.APPROVED,
        featured: true,
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { products },
    });
  } catch (error) {
    console.error('getFeaturedProducts error:', error);
    next(error);
  }
};

// Get bestsellers
export const getBestsellers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: ProductStatus.APPROVED,
        bestseller: true,
      },
      take: 8,
      orderBy: { downloadCount: 'desc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { products },
    });
  } catch (error) {
    console.error('getBestsellers error:', error);
    next(error);
  }
};

// Get new arrivals
export const getNewArrivals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: ProductStatus.APPROVED,
        newArrival: true,
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { products },
    });
  } catch (error) {
    console.error('getNewArrivals error:', error);
    next(error);
  }
};

// Get product by slug
export const getProductBySlug = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
            businessEmail: true,
            logo: true,
            description: true,
          },
        },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Increment view count
    await prisma.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    });

    res.json({
      success: true,
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// Create product (Vendor only)
export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    // Get vendor profile
    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendorProfile) {
      throw new AppError('Vendor profile not found', 404);
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

    // Create product
    const product = await prisma.product.create({
      data: {
        title,
        slug,
        description,
        shortDescription,
        price,
        originalPrice,
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
        vendorId: vendorProfile.id,
        status: vendorProfile.autoApproveProducts ? ProductStatus.APPROVED : ProductStatus.PENDING_REVIEW,
      },
      include: {
        category: true,
        vendor: {
          select: {
            id: true,
            businessName: true,
            logo: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// Update product
export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Get product
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { vendor: true },
    });

    if (!existingProduct) {
      throw new AppError('Product not found', 404);
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'ADMIN' && existingProduct.vendor.userId !== req.user.id) {
      throw new AppError('You do not have permission to update this product', 403);
    }

    const updateData: any = { ...req.body };

    // Recalculate discount if prices changed
    if (updateData.price && updateData.originalPrice) {
      updateData.discount = Math.round(
        ((updateData.originalPrice - updateData.price) / updateData.originalPrice) * 100
      );
    }

    // Update slug if title changed
    if (updateData.title && updateData.title !== existingProduct.title) {
      updateData.slug = updateData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Convert fileSize to BigInt if provided
    if (updateData.fileSize) {
      updateData.fileSize = BigInt(updateData.fileSize);
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        vendor: {
          select: {
            id: true,
            businessName: true,
            logo: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// Delete product
export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    // Get product
    const product = await prisma.product.findUnique({
      where: { id },
      include: { vendor: true },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'ADMIN' && product.vendor.userId !== req.user.id) {
      throw new AppError('You do not have permission to delete this product', 403);
    }

    await prisma.product.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Approve product (Admin only)
export const approveProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.update({
      where: { id },
      data: {
        status: ProductStatus.APPROVED,
        publishedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Product approved successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// Reject product (Admin only)
export const rejectProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        status: ProductStatus.REJECTED,
        rejectionReason: reason,
      },
    });

    res.json({
      success: true,
      message: 'Product rejected',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

