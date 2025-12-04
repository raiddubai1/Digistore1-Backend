import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// Get all categories
export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      include: {
        children: {
          where: { active: true },
          orderBy: { order: 'asc' },
          include: {
            children: {
              where: { active: true },
              orderBy: { order: 'asc' },
              include: {
                _count: {
                  select: { products: true },
                },
              },
            },
            _count: {
              select: { products: true },
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
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

// Get category by slug
export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        children: {
          where: { active: true },
          orderBy: { order: 'asc' },
          include: {
            children: {
              where: { active: true },
              orderBy: { order: 'asc' },
              include: {
                _count: {
                  select: { products: true },
                },
              },
            },
            _count: {
              select: { products: true },
            },
          },
        },
        parent: {
          include: {
            parent: true, // Include grandparent for breadcrumbs
          },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    res.json({
      success: true,
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

// Create category (Admin only)
export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, icon, image, parentId, order } = req.body;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        icon,
        image,
        parentId,
        order: order || 0,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

// Update category (Admin only)
export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.name) {
      updateData.slug = updateData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

// Delete category (Admin only)
export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { force } = req.query; // Add force=true to delete with products

    // Check if category has products
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0 && force !== 'true') {
      throw new AppError(
        `Cannot delete category with ${productCount} existing product(s). Use force=true to delete all products in this category first.`,
        400
      );
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      if (force === 'true' && productCount > 0) {
        // First, delete all related data for products in this category
        const productIds = await tx.product.findMany({
          where: { categoryId: id },
          select: { id: true },
        });

        const ids = productIds.map(p => p.id);

        // Delete product-related records
        await tx.productAttribute.deleteMany({ where: { productId: { in: ids } } });
        await tx.review.deleteMany({ where: { productId: { in: ids } } });
        await tx.wishlist.deleteMany({ where: { productId: { in: ids } } });
        await tx.download.deleteMany({ where: { productId: { in: ids } } });
        await tx.orderItem.deleteMany({ where: { productId: { in: ids } } });

        // Delete products in this category
        await tx.product.deleteMany({ where: { categoryId: id } });
      }

      // Delete child categories first
      await tx.category.deleteMany({ where: { parentId: id } });

      // Delete the category
      await tx.category.delete({ where: { id } });
    });

    res.json({
      success: true,
      message: force === 'true' && productCount > 0
        ? `Category and ${productCount} product(s) deleted successfully`
        : 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

