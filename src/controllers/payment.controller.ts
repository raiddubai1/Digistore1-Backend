import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { createPayPalOrder, capturePayPalPayment, verifyPayPalWebhook } from '../config/paypal';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { sendOrderConfirmationEmail } from '../services/email.service';
import { isFirstTimeBuyer } from './coupon.controller';

// Helper to validate and calculate coupon discount
async function validateCouponForPayment(
  couponCode: string | undefined,
  subtotal: number,
  userId?: string,
  email?: string
): Promise<{ valid: boolean; discountAmount: number; couponId: string | null; message?: string }> {
  if (!couponCode) {
    return { valid: true, discountAmount: 0, couponId: null };
  }

  const upperCode = couponCode.toUpperCase().trim();
  const coupon = await prisma.coupon.findUnique({ where: { code: upperCode } });

  if (!coupon) {
    return { valid: false, discountAmount: 0, couponId: null, message: 'Invalid coupon code' };
  }

  if (!coupon.active) {
    return { valid: false, discountAmount: 0, couponId: null, message: 'Coupon is not active' };
  }

  if (coupon.expiresAt && new Date() > coupon.expiresAt) {
    return { valid: false, discountAmount: 0, couponId: null, message: 'Coupon has expired' };
  }

  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return { valid: false, discountAmount: 0, couponId: null, message: 'Coupon usage limit reached' };
  }

  if (coupon.minPurchase && subtotal < Number(coupon.minPurchase)) {
    return { valid: false, discountAmount: 0, couponId: null, message: `Minimum purchase of $${Number(coupon.minPurchase)} required` };
  }

  // Check first-purchase-only restriction
  if (coupon.firstPurchaseOnly) {
    const isFirstTime = await isFirstTimeBuyer(userId, email);
    if (!isFirstTime) {
      return { valid: false, discountAmount: 0, couponId: null, message: 'This coupon is only valid for first-time buyers' };
    }
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.type === 'PERCENTAGE') {
    discountAmount = (subtotal * Number(coupon.value)) / 100;
    if (coupon.maxDiscount) {
      discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
    }
  } else {
    discountAmount = Math.min(Number(coupon.value), subtotal);
  }

  return { valid: true, discountAmount, couponId: coupon.id };
}

// Create PayPal order with server-side coupon validation
export const createPayPalOrderHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items, totalAmount, currency = 'USD', couponCode, email } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Cart items are required', 400);
    }

    // Calculate subtotal from items (don't trust client's totalAmount)
    let serverSubtotal = 0;
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        throw new AppError(`Product not found: ${item.productId}`, 404);
      }
      let itemPrice = Number(product.price);
      // Apply license multiplier
      if (item.license === 'COMMERCIAL' || item.license === 'commercial') itemPrice *= 3;
      if (item.license === 'EXTENDED' || item.license === 'extended') itemPrice *= 5;
      serverSubtotal += itemPrice * (item.quantity || 1);
    }

    // Validate coupon server-side
    const couponResult = await validateCouponForPayment(couponCode, serverSubtotal, req.user?.id, email);
    if (!couponResult.valid && couponCode) {
      throw new AppError(couponResult.message || 'Invalid coupon', 400);
    }

    // Calculate final total
    const finalTotal = Math.max(0, serverSubtotal - couponResult.discountAmount);

    // Create PayPal order with server-calculated total
    const paypalOrder = await createPayPalOrder(
      finalTotal,
      currency,
      items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unit_amount: item.price - (couponResult.discountAmount / items.length / item.quantity), // Distribute discount
      }))
    );

    res.json({
      success: true,
      data: {
        orderId: paypalOrder.id,
        approvalUrl: paypalOrder.links.find((link: any) => link.rel === 'approve')?.href,
        serverTotal: finalTotal,
        discount: couponResult.discountAmount,
      },
    });
  } catch (error: any) {
    console.error('PayPal order creation error:', error.response?.data || error.message);
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to create PayPal order', 500));
    }
  }
};

// Capture PayPal payment and create order
export const capturePayPalOrderHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paypalOrderId, items, billingInfo, couponCode } = req.body;

    if (!paypalOrderId) {
      throw new AppError('PayPal order ID is required', 400);
    }

    // Capture the payment
    const captureData = await capturePayPalPayment(paypalOrderId);

    if (captureData.status !== 'COMPLETED') {
      throw new AppError('Payment was not completed', 400);
    }

    const capturedAmount = parseFloat(
      captureData.purchase_units[0].payments.captures[0].amount.value
    );
    const currency = captureData.purchase_units[0].payments.captures[0].amount.currency_code;

    // Get or create customer
    let customerId = req.user?.id;
    let customerEmail = billingInfo.email;

    if (!customerId) {
      // Guest checkout - find or create user
      let user = await prisma.user.findUnique({
        where: { email: customerEmail },
      });

      if (!user) {
        // Create guest user
        user = await prisma.user.create({
          data: {
            email: customerEmail,
            name: `${billingInfo.firstName} ${billingInfo.lastName}`,
            password: '', // Guest user, no password
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        });

        await prisma.customerProfile.create({
          data: { userId: user.id },
        });
      }
      customerId = user.id;
    }

    // Calculate subtotal from items for coupon validation
    let serverSubtotal = 0;
    for (const item of items) {
      serverSubtotal += (item.price || 0) * (item.quantity || 1);
    }

    // Validate coupon server-side using the shared helper
    const couponResult = await validateCouponForPayment(
      couponCode,
      serverSubtotal,
      customerId,
      customerEmail
    );

    let discountAmount = couponResult.discountAmount;
    let couponId = couponResult.couponId;

    // Update coupon usage if valid
    if (couponId) {
      await prisma.coupon.update({
        where: { id: couponId },
        data: { usageCount: { increment: 1 } },
      });
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        customerId,
        status: OrderStatus.COMPLETED,
        subtotal: capturedAmount + discountAmount,
        discount: discountAmount,
        total: capturedAmount,
        currency,
        paymentMethod: 'PAYPAL',
        paymentId: paypalOrderId,
        paymentStatus: 'PAID',
        couponId,
        billingEmail: customerEmail,
        billingName: `${billingInfo.firstName} ${billingInfo.lastName}`,
        billingCountry: billingInfo.country,
        orderItems: {
          create: items.map((item: any) => ({
            productId: item.productId,
            vendorId: item.vendorId,
            quantity: item.quantity,
            price: item.price,
            license: item.license || 'personal',
          })),
        },
      },
      include: {
        orderItems: {
          include: { product: true },
        },
      },
    });

    // Create download records for digital products
    for (const orderItem of order.orderItems) {
      if (orderItem.product.fileUrl) {
        await prisma.download.create({
          data: {
            orderId: order.id,
            productId: orderItem.productId,
            userId: customerId,
            downloadUrl: orderItem.product.fileUrl,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
      }
    }

    // Update vendor sales stats
    for (const item of items) {
      if (item.vendorId) {
        await prisma.vendorProfile.update({
          where: { id: item.vendorId },
          data: {
            totalSales: { increment: item.quantity },
            totalRevenue: { increment: item.price * item.quantity * 0.85 }, // 15% platform fee
          },
        });
      }
    }

    // Send order confirmation email (non-blocking)
    try {
      await sendOrderConfirmationEmail(
        customerEmail,
        billingInfo.firstName,
        {
          id: order.id,
          total: capturedAmount,
          currency,
          items: order.orderItems.map((item: any) => ({
            title: item.product.title,
            price: Number(item.price),
            quantity: item.quantity,
            license: item.license,
            canvaTemplateLink: item.product.canvaTemplateLink || undefined,
          })),
        }
      );
    } catch (emailError) {
      console.error('Failed to send order confirmation email:', emailError);
    }

    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          status: order.status,
          total: order.total,
          currency: order.currency,
        },
        message: 'Payment successful! Your order has been placed.',
      },
    });
  } catch (error: any) {
    console.error('PayPal capture error:', error.response?.data || error.message);
    next(new AppError(error.message || 'Failed to capture payment', 500));
  }
};

// PayPal webhook handler
export const handlePayPalWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      console.warn('PayPal webhook ID not configured');
      return res.json({ received: true });
    }

    const isValid = await verifyPayPalWebhook(webhookId, req.body, req.headers);

    if (!isValid) {
      throw new AppError('Invalid webhook signature', 400);
    }

    const event = req.body;

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment was captured successfully
        console.log('Payment captured:', event.resource.id);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        // Payment was denied
        const orderId = event.resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          await prisma.order.updateMany({
            where: { paymentId: orderId },
            data: {
              status: OrderStatus.CANCELLED,
              paymentStatus: 'FAILED',
            },
          });
        }
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        // Payment was refunded
        console.log('Payment refunded:', event.resource.id);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    next(error);
  }
};

// Legacy Stripe handlers (kept for future implementation)
export const createPaymentIntent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Not authenticated', 401);

    res.json({
      success: true,
      message: 'Stripe payment - coming soon. Please use PayPal.',
    });
  } catch (error) {
    next(error);
  }
};

export const handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};

export const getPaymentMethods = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: {
        methods: [
          { id: 'paypal', name: 'PayPal', enabled: true },
          { id: 'stripe', name: 'Credit/Debit Card', enabled: false, comingSoon: true },
        ]
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create free order (for $0 products)
export const createFreeOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items, billingInfo } = req.body;

    console.log('createFreeOrder called with:', { items, billingInfo, userId: req.user?.id });

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Cart items are required', 400);
    }

    if (!billingInfo?.email || !billingInfo?.firstName || !billingInfo?.lastName) {
      throw new AppError('Billing info (email, firstName, lastName) is required', 400);
    }

    // Validate all items are free
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new AppError(`Product not found: ${item.productId}`, 404);
      }

      if (Number(product.price) > 0) {
        throw new AppError('Free order endpoint cannot process paid products', 400);
      }
    }

    // Get or create customer
    let customerId = req.user?.id;
    let customerEmail = billingInfo.email;

    if (!customerId) {
      // Guest checkout - find or create user by email
      let user = await prisma.user.findUnique({
        where: { email: customerEmail },
      });

      if (!user) {
        // Create guest user
        user = await prisma.user.create({
          data: {
            email: customerEmail,
            name: `${billingInfo.firstName} ${billingInfo.lastName}`,
            password: '', // Guest user, no password
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        });

        await prisma.customerProfile.create({
          data: { userId: user.id },
        });
      }
      customerId = user.id;
    }

    console.log('Creating order for customerId:', customerId);

    // Create order
    const order = await prisma.order.create({
      data: {
        customerId: customerId!,
        status: OrderStatus.COMPLETED,
        subtotal: 0,
        discount: 0,
        total: 0,
        currency: 'USD',
        paymentMethod: PaymentMethod.FREE,
        paymentStatus: 'PAID',
        billingEmail: customerEmail,
        billingName: `${billingInfo.firstName} ${billingInfo.lastName}`,
        billingCountry: billingInfo.country || 'US',
        orderItems: {
          create: items.map((item: any) => ({
            productId: item.productId,
            vendorId: item.vendorId || null,
            quantity: item.quantity || 1,
            price: 0,
            license: item.license || 'personal',
          })),
        },
      },
      include: {
        orderItems: {
          include: { product: true },
        },
      },
    });

    console.log('Order created successfully:', order.id);

    // Create download records for digital products
    for (const orderItem of order.orderItems) {
      if (orderItem.product.fileUrl) {
        try {
          await prisma.download.create({
            data: {
              orderId: order.id,
              productId: orderItem.productId,
              userId: customerId!,
              downloadUrl: orderItem.product.fileUrl,
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for free products
            },
          });
        } catch (downloadError) {
          console.error('Failed to create download record:', downloadError);
          // Continue - order is already created, download failure shouldn't fail the order
        }
      }
    }

    // Update product download counts
    for (const orderItem of order.orderItems) {
      try {
        await prisma.product.update({
          where: { id: orderItem.productId },
          data: { downloadCount: { increment: 1 } },
        });
      } catch (countError) {
        console.error('Failed to update download count:', countError);
      }
    }

    // Send confirmation email (fire and forget - don't await)
    sendOrderConfirmationEmail(
      customerEmail,
      billingInfo.firstName,
      {
        id: order.id,
        total: 0,
        currency: 'USD',
        items: order.orderItems.map((item: any) => ({
          title: item.product.title,
          price: 0,
          quantity: item.quantity,
          license: item.license,
          canvaTemplateLink: item.product.canvaTemplateLink || undefined,
        })),
      }
    ).catch((emailError) => {
      console.error('Failed to send order confirmation email:', emailError);
    });

    // Only return what's needed - avoid BigInt serialization issues
    res.status(201).json({
      success: true,
      message: 'Free order completed successfully',
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: 0,
        }
      },
    });
  } catch (error: any) {
    console.error('createFreeOrder error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    // Return detailed error for debugging
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create free order',
      error: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      details: error.code || error.name,
    });
  }
};

// Check if user is eligible for first-purchase discount
export const checkFirstPurchaseDiscount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const email = req.query.email as string;

    // First-purchase discount settings
    const FIRST_PURCHASE_DISCOUNT_PERCENT = 30;

    // If user is logged in, check their order history
    if (userId) {
      const orderCount = await prisma.order.count({
        where: {
          customerId: userId,
          status: {
            in: ['COMPLETED', 'PROCESSING'],
          },
        },
      });

      if (orderCount === 0) {
        return res.json({
          success: true,
          data: {
            isFirstPurchase: true,
            discountPercent: FIRST_PURCHASE_DISCOUNT_PERCENT,
            message: `Welcome! Enjoy ${FIRST_PURCHASE_DISCOUNT_PERCENT}% off your first purchase!`,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          isFirstPurchase: false,
          discountPercent: 0,
          message: null,
        },
      });
    }

    // For guest checkout, check by email if provided
    if (email) {
      // Check if this email has any completed orders (as guest or registered)
      const existingOrders = await prisma.order.count({
        where: {
          OR: [
            { billingEmail: email },
            { customer: { email: email } },
          ],
          status: {
            in: ['COMPLETED', 'PROCESSING'],
          },
        },
      });

      if (existingOrders === 0) {
        return res.json({
          success: true,
          data: {
            isFirstPurchase: true,
            discountPercent: FIRST_PURCHASE_DISCOUNT_PERCENT,
            message: `Welcome! Enjoy ${FIRST_PURCHASE_DISCOUNT_PERCENT}% off your first purchase!`,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          isFirstPurchase: false,
          discountPercent: 0,
          message: null,
        },
      });
    }

    // If no user and no email, assume first purchase (will validate again at checkout)
    return res.json({
      success: true,
      data: {
        isFirstPurchase: true,
        discountPercent: FIRST_PURCHASE_DISCOUNT_PERCENT,
        message: `Welcome! Enjoy ${FIRST_PURCHASE_DISCOUNT_PERCENT}% off your first purchase!`,
      },
    });
  } catch (error: any) {
    console.error('First purchase check error:', error);
    // Return no discount on error (fail safe)
    return res.json({
      success: true,
      data: {
        isFirstPurchase: false,
        discountPercent: 0,
        message: null,
      },
    });
  }
};

