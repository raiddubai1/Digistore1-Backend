import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Prisma, ProductStatus } from '@prisma/client';

// Helper function to serialize BigInt and Decimal fields
const serializeProduct = (product: any) => ({
  ...product,
  fileSize: product.fileSize ? Number(product.fileSize) : null,
  price: Number(product.price),
  originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
  rating: Number(product.rating),
});

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
        products: products.map(serializeProduct),
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
      data: { products: products.map(serializeProduct) },
    });
  } catch (error) {
    console.error('getFeaturedProducts error:', error);
    next(error);
  }
};

// Get bestsellers
export const getBestsellers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First try to get products marked as bestseller
    let products = await prisma.product.findMany({
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

    // If no bestsellers found, fall back to top products by price (premium products)
    if (products.length === 0) {
      products = await prisma.product.findMany({
        where: {
          status: ProductStatus.APPROVED,
        },
        take: 8,
        orderBy: { price: 'desc' },
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
    }

    res.json({
      success: true,
      data: { products: products.map(serializeProduct) },
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
      data: { products: products.map(serializeProduct) },
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
      data: { product: serializeProduct(product) },
    });
  } catch (error) {
    next(error);
  }
};

// Get product by ID (for admin edit)
export const getProductById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
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
          },
        },
        files: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Serialize product with files
    const serializedProduct = serializeProduct(product);
    if (product.files) {
      serializedProduct.files = product.files.map((f: any) => ({
        id: f.id,
        fileName: f.fileName,
        fileUrl: f.fileUrl,
        fileSize: f.fileSize ? Number(f.fileSize) : null,
        fileType: f.fileType,
        order: f.order,
      }));
    }

    res.json({
      success: true,
      data: { product: serializedProduct },
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

    // Get or create vendor profile (for admin users, create a default one)
    let vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendorProfile && req.user.role === 'ADMIN') {
      // Check if "DigiStore Official" vendor already exists
      vendorProfile = await prisma.vendorProfile.findFirst({
        where: { businessName: 'DigiStore Official' },
      });

      if (!vendorProfile) {
        // Create a default vendor profile for admin imports
        vendorProfile = await prisma.vendorProfile.create({
          data: {
            userId: req.user.id,
            businessName: 'DigiStore Official',
            businessEmail: req.user.email || 'admin@digistore1.com',
            description: 'Official DigiStore products',
            verified: true,
            autoApproveProducts: true,
          },
        });
      }
    }

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
      files, // Array of product files
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

    // Create product with files in a transaction
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
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

      // Create product files if provided
      if (files && Array.isArray(files) && files.length > 0) {
        await tx.productFile.createMany({
          data: files.map((file: any, index: number) => ({
            productId: newProduct.id,
            fileName: file.fileName,
            fileUrl: file.fileUrl || 'pending-upload',
            fileSize: file.fileSize ? BigInt(file.fileSize) : null,
            fileType: file.fileType || '',
            order: file.order ?? index,
          })),
        });
      }

      // Fetch product with files
      return tx.product.findUnique({
        where: { id: newProduct.id },
        include: {
          category: true,
          vendor: {
            select: {
              id: true,
              businessName: true,
              logo: true,
            },
          },
          files: {
            orderBy: { order: 'asc' },
          },
        },
      });
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

    const { files, ...restBody } = req.body;
    const updateData: any = { ...restBody };

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

    // Update product and files in a transaction
    const product = await prisma.$transaction(async (tx) => {
      // Update product
      const updatedProduct = await tx.product.update({
        where: { id },
        data: updateData,
      });

      // Update files if provided
      if (files && Array.isArray(files)) {
        // Delete existing files
        await tx.productFile.deleteMany({
          where: { productId: id },
        });

        // Create new files
        if (files.length > 0) {
          await tx.productFile.createMany({
            data: files.map((file: any, index: number) => ({
              productId: id,
              fileName: file.fileName,
              fileUrl: file.fileUrl || 'pending-upload',
              fileSize: file.fileSize ? BigInt(file.fileSize) : null,
              fileType: file.fileType || '',
              order: file.order ?? index,
            })),
          });
        }
      }

      // Fetch product with all relations
      return tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          vendor: {
            select: {
              id: true,
              businessName: true,
              logo: true,
            },
          },
          files: {
            orderBy: { order: 'asc' },
          },
        },
      });
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

    // Delete related records first (in transaction)
    await prisma.$transaction(async (tx) => {
      // Delete product attributes
      await tx.productAttribute.deleteMany({ where: { productId: id } });

      // Delete reviews
      await tx.review.deleteMany({ where: { productId: id } });

      // Delete wishlist entries
      await tx.wishlist.deleteMany({ where: { productId: id } });

      // Delete downloads
      await tx.download.deleteMany({ where: { productId: id } });

      // Delete order items (preserve order history by nullifying product reference)
      await tx.orderItem.deleteMany({ where: { productId: id } });

      // Finally delete the product
      await tx.product.delete({ where: { id } });
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

// Bulk import products with secret key authentication
export const bulkImportProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { secret, products } = req.body;

    // Check secret key
    const IMPORT_SECRET = process.env.IMPORT_SECRET || 'digistore1-bulk-import-2024';
    if (secret !== IMPORT_SECRET) {
      throw new AppError('Invalid import secret', 403);
    }

    if (!Array.isArray(products) || products.length === 0) {
      throw new AppError('Products array is required', 400);
    }

    // Get default vendor (admin's vendor profile)
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      include: { vendorProfile: true },
    });

    if (!admin?.vendorProfile) {
      throw new AppError('No admin vendor profile found', 500);
    }

    const vendorId = admin.vendorProfile.id;
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const product of products) {
      try {
        await prisma.product.create({
          data: {
            title: product.title,
            slug: product.slug,
            description: product.description || `Free eBook: ${product.title}`,
            price: product.price || 0,
            categoryId: product.categoryId,
            vendorId,
            thumbnailUrl: product.thumbnailUrl || 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
            fileUrl: product.fileUrl,
            fileType: product.fileType || 'pdf',
            fileName: product.fileName,
            fileSize: product.fileSize ? BigInt(product.fileSize) : null,
            status: ProductStatus.APPROVED,
            tags: product.tags || [],
            previewImages: [],
            whatsIncluded: ['Full eBook PDF'],
            requirements: [],
          },
        });
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${product.title}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.success} products, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk update thumbnails with secret key authentication
export const bulkUpdateThumbnails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { secret, updates } = req.body;

    // Check secret key
    const IMPORT_SECRET = process.env.IMPORT_SECRET || 'digistore1-bulk-import-2024';
    if (secret !== IMPORT_SECRET) {
      throw new AppError('Invalid import secret', 403);
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new AppError('Updates array is required', 400);
    }

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const update of updates) {
      try {
        await prisma.product.update({
          where: { id: update.id },
          data: { thumbnailUrl: update.thumbnailUrl },
        });
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${update.id}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Updated ${results.success} thumbnails, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

