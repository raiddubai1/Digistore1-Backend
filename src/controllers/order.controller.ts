import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Get user's orders
export const getMyOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                thumbnailUrl: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    next(error);
  }
};

// Get order by ID
export const getOrderById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
        downloads: true,
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check ownership
    if (order.customerId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('You do not have permission to view this order', 403);
    }

    res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

// Create order (will be completed with Stripe integration)
export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { items, couponCode } = req.body;

    // Calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { vendor: true },
      });

      if (!product) {
        throw new AppError(`Product ${item.productId} not found`, 404);
      }

      // Calculate price based on license
      let price = Number(product.price);
      if (item.license === 'COMMERCIAL') price *= 3;
      if (item.license === 'EXTENDED') price *= 5;

      subtotal += price;

      // Calculate vendor revenue (85% to vendor, 15% platform fee)
      const platformFee = price * 0.15;
      const vendorRevenue = price - platformFee;

      orderItems.push({
        productId: product.id,
        productTitle: product.title,
        productSlug: product.slug,
        price,
        license: item.license,
        vendorId: product.vendorId,
        vendorRevenue,
        platformFee,
      });
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: req.user.id,
        subtotal,
        total: subtotal,
        status: 'PENDING',
        paymentMethod: 'STRIPE',
        billingEmail: req.user.email,
        billingName: req.user.email,
        orderItems: {
          create: orderItems,
        },
      },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

