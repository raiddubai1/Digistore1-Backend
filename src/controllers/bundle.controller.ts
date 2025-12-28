import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// Get all active bundles (public)
export const getAllBundles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    
    const bundles = await prisma.bundle.findMany({
      where: {
        active: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: now } },
            ],
          },
        ],
      },
      orderBy: [
        { featured: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        products: {
          orderBy: { order: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                price: true,
                thumbnailUrl: true,
                rating: true,
                reviewCount: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: { bundles },
    });
  } catch (error) {
    next(error);
  }
};

// Get bundle by slug (public)
export const getBundleBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const bundle = await prisma.bundle.findUnique({
      where: { slug },
      include: {
        products: {
          orderBy: { order: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                price: true,
                originalPrice: true,
                thumbnailUrl: true,
                rating: true,
                reviewCount: true,
                shortDescription: true,
                fileType: true,
              },
            },
          },
        },
      },
    });

    if (!bundle) {
      throw new AppError('Bundle not found', 404);
    }

    res.json({
      success: true,
      data: { bundle },
    });
  } catch (error) {
    next(error);
  }
};

// Get all bundles for admin (includes inactive)
export const getAllBundlesAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bundles = await prisma.bundle.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        products: {
          orderBy: { order: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                price: true,
                thumbnailUrl: true,
              },
            },
          },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    res.json({
      success: true,
      data: { bundles },
    });
  } catch (error) {
    next(error);
  }
};

// Create bundle (Admin only)
export const createBundle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, bundlePrice, image, featured, active, startsAt, expiresAt, productIds } = req.body;

    if (!name || bundlePrice === undefined) {
      throw new AppError('Name and bundle price are required', 400);
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug exists
    const existingBundle = await prisma.bundle.findUnique({ where: { slug } });
    if (existingBundle) {
      throw new AppError('A bundle with this name already exists', 400);
    }

    // Calculate original price from products
    let originalPrice = 0;
    if (productIds && productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { price: true },
      });
      originalPrice = products.reduce((sum, p) => sum + Number(p.price), 0);
    }

    // Calculate discount percentage
    const discount = originalPrice > 0 ? Math.round(((originalPrice - bundlePrice) / originalPrice) * 100) : 0;

    const bundle = await prisma.bundle.create({
      data: {
        name,
        slug,
        description,
        bundlePrice,
        originalPrice,
        discount,
        image,
        featured: featured || false,
        active: active !== false,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        products: productIds?.length
          ? {
              create: productIds.map((productId: string, index: number) => ({
                productId,
                order: index,
              })),
            }
          : undefined,
      },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                price: true,
                thumbnailUrl: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Bundle created successfully',
      data: { bundle },
    });
  } catch (error) {
    next(error);
  }
};

// Update bundle (Admin only)
export const updateBundle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, bundlePrice, image, featured, active, startsAt, expiresAt, productIds } = req.body;

    const existingBundle = await prisma.bundle.findUnique({ where: { id } });
    if (!existingBundle) {
      throw new AppError('Bundle not found', 404);
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (name) {
      updateData.name = name;
      updateData.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (featured !== undefined) updateData.featured = featured;
    if (active !== undefined) updateData.active = active;
    if (startsAt !== undefined) updateData.startsAt = startsAt ? new Date(startsAt) : null;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    // Recalculate prices if productIds or bundlePrice changed
    if (productIds !== undefined || bundlePrice !== undefined) {
      let originalPrice = Number(existingBundle.originalPrice);

      if (productIds !== undefined && productIds.length > 0) {
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { price: true },
        });
        originalPrice = products.reduce((sum, p) => sum + Number(p.price), 0);
        updateData.originalPrice = originalPrice;
      }

      const newBundlePrice = bundlePrice !== undefined ? bundlePrice : Number(existingBundle.bundlePrice);
      updateData.bundlePrice = newBundlePrice;
      updateData.discount = originalPrice > 0 ? Math.round(((originalPrice - newBundlePrice) / originalPrice) * 100) : 0;
    }

    // Update bundle and products in transaction
    const bundle = await prisma.$transaction(async (tx) => {
      // Update products if provided
      if (productIds !== undefined) {
        // Delete existing product associations
        await tx.bundleProduct.deleteMany({ where: { bundleId: id } });

        // Create new associations
        if (productIds.length > 0) {
          await tx.bundleProduct.createMany({
            data: productIds.map((productId: string, index: number) => ({
              bundleId: id,
              productId,
              order: index,
            })),
          });
        }
      }

      // Update bundle
      return tx.bundle.update({
        where: { id },
        data: updateData,
        include: {
          products: {
            orderBy: { order: 'asc' },
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  price: true,
                  thumbnailUrl: true,
                },
              },
            },
          },
        },
      });
    });

    res.json({
      success: true,
      message: 'Bundle updated successfully',
      data: { bundle },
    });
  } catch (error) {
    next(error);
  }
};

// Delete bundle (Admin only)
export const deleteBundle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const bundle = await prisma.bundle.findUnique({ where: { id } });
    if (!bundle) {
      throw new AppError('Bundle not found', 404);
    }

    await prisma.bundle.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Bundle deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

