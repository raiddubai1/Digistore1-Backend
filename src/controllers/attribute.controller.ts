import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// Get all attributes
export const getAttributes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active } = req.query;

    const where: any = {};
    if (active !== undefined) {
      where.active = active === 'true';
    }

    const attributes = await prisma.attribute.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { productAttributes: true },
        },
      },
    });

    res.json({
      success: true,
      data: attributes,
    });
  } catch (error) {
    next(error);
  }
};

// Get single attribute
export const getAttribute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const attribute = await prisma.attribute.findUnique({
      where: { id },
      include: {
        _count: {
          select: { productAttributes: true },
        },
      },
    });

    if (!attribute) {
      throw new AppError('Attribute not found', 404);
    }

    res.json({
      success: true,
      data: attribute,
    });
  } catch (error) {
    next(error);
  }
};

// Create attribute
export const createAttribute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, description, type, options, required, active, order } = req.body;

    // Check if slug already exists
    const existingAttribute = await prisma.attribute.findUnique({
      where: { slug },
    });

    if (existingAttribute) {
      throw new AppError('Attribute with this slug already exists', 400);
    }

    const attribute = await prisma.attribute.create({
      data: {
        name,
        slug,
        description,
        type,
        options: options || [],
        required: required || false,
        active: active !== undefined ? active : true,
        order: order || 0,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Attribute created successfully',
      data: attribute,
    });
  } catch (error) {
    next(error);
  }
};

// Update attribute
export const updateAttribute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, slug, description, type, options, required, active, order } = req.body;

    // Check if attribute exists
    const existingAttribute = await prisma.attribute.findUnique({
      where: { id },
    });

    if (!existingAttribute) {
      throw new AppError('Attribute not found', 404);
    }

    // If slug is being changed, check if new slug is available
    if (slug && slug !== existingAttribute.slug) {
      const slugExists = await prisma.attribute.findUnique({
        where: { slug },
      });

      if (slugExists) {
        throw new AppError('Attribute with this slug already exists', 400);
      }
    }

    const attribute = await prisma.attribute.update({
      where: { id },
      data: {
        name,
        slug,
        description,
        type,
        options,
        required,
        active,
        order,
      },
    });

    res.json({
      success: true,
      message: 'Attribute updated successfully',
      data: attribute,
    });
  } catch (error) {
    next(error);
  }
};

// Delete attribute
export const deleteAttribute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if attribute exists
    const attribute = await prisma.attribute.findUnique({
      where: { id },
      include: {
        _count: {
          select: { productAttributes: true },
        },
      },
    });

    if (!attribute) {
      throw new AppError('Attribute not found', 404);
    }

    // Check if attribute is being used by products
    if (attribute._count.productAttributes > 0) {
      throw new AppError(
        `Cannot delete attribute. It is being used by ${attribute._count.productAttributes} product(s)`,
        400
      );
    }

    await prisma.attribute.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Attribute deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get product attributes
export const getProductAttributes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;

    const productAttributes = await prisma.productAttribute.findMany({
      where: { productId },
      include: {
        attribute: true,
      },
    });

    res.json({
      success: true,
      data: productAttributes,
    });
  } catch (error) {
    next(error);
  }
};

// Set product attributes
export const setProductAttributes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const { attributes } = req.body; // Array of { attributeId, value }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Delete existing product attributes
    await prisma.productAttribute.deleteMany({
      where: { productId },
    });

    // Create new product attributes
    if (attributes && attributes.length > 0) {
      await prisma.productAttribute.createMany({
        data: attributes.map((attr: any) => ({
          productId,
          attributeId: attr.attributeId,
          value: attr.value,
        })),
      });
    }

    // Fetch updated product attributes
    const productAttributes = await prisma.productAttribute.findMany({
      where: { productId },
      include: {
        attribute: true,
      },
    });

    res.json({
      success: true,
      message: 'Product attributes updated successfully',
      data: productAttributes,
    });
  } catch (error) {
    next(error);
  }
};


