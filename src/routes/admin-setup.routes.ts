import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../utils/password';
import { ProductStatus } from '@prisma/client';

const router = Router();

// Seed database endpoint - creates demo data if database is empty
router.post('/seed', async (req, res) => {
  try {
    // Check if products already exist
    const productCount = await prisma.product.count();

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Database already seeded. Products exist.',
      });
    }

    // Get or create categories
    let businessCategory = await prisma.category.findUnique({
      where: { slug: 'business-and-marketing' },
    });
    if (!businessCategory) {
      businessCategory = await prisma.category.create({
        data: {
          name: 'Business and Marketing',
          slug: 'business-and-marketing',
          description: 'eBooks on business strategies, marketing, and entrepreneurship',
          icon: 'briefcase',
          order: 1,
        },
      });
    }

    let personalCategory = await prisma.category.findUnique({
      where: { slug: 'personal-development' },
    });
    if (!personalCategory) {
      personalCategory = await prisma.category.create({
        data: {
          name: 'Personal Development',
          slug: 'personal-development',
          description: 'Self-improvement, relationships, and personal growth',
          icon: 'sparkles',
          order: 2,
        },
      });
    }

    let techCategory = await prisma.category.findUnique({
      where: { slug: 'technology' },
    });
    if (!techCategory) {
      techCategory = await prisma.category.create({
        data: {
          name: 'Technology',
          slug: 'technology',
          description: 'Programming, software development, and tech guides',
          icon: 'code',
          order: 3,
        },
      });
    }

    // Get or create vendor user
    let vendor = await prisma.user.findUnique({
      where: { email: 'vendor@example.com' },
      include: { vendorProfile: true },
    });

    if (!vendor) {
      const vendorPassword = await hashPassword('vendor123456');
      vendor = await prisma.user.create({
        data: {
          email: 'vendor@example.com',
          password: vendorPassword,
          name: 'Demo Vendor',
          role: 'VENDOR',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          vendorProfile: {
            create: {
              businessName: 'Digital Products Co.',
              businessEmail: 'vendor@example.com',
              description: 'We create high-quality digital products',
              website: 'https://example.com',
            },
          },
        },
        include: {
          vendorProfile: true,
        },
      });
    }

    // Get or create customer user
    const existingCustomer = await prisma.user.findUnique({
      where: { email: 'customer@example.com' },
    });

    if (!existingCustomer) {
      const customerPassword = await hashPassword('customer123456');
      await prisma.user.create({
        data: {
            email: 'customer@example.com',
          password: customerPassword,
          name: 'Demo Customer',
          role: 'CUSTOMER',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          customerProfile: {
            create: {},
          },
        },
      });
    }

    // Create demo products
    await prisma.product.create({
      data: {
        title: 'Complete Digital Marketing Masterclass',
        slug: 'complete-digital-marketing-masterclass',
        description: 'Master digital marketing with this comprehensive course covering SEO, social media, email marketing, and more.',
        shortDescription: 'Learn digital marketing from scratch to advanced level',
        price: 49.99,
        categoryId: businessCategory.id,
        vendorId: vendor.vendorProfile!.id,
        fileUrl: 'https://example.com/files/marketing-course.zip',
        fileName: 'marketing-course.zip',
        fileSize: 524288000,
        fileType: 'zip',
        thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
        previewImages: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f'],
        tags: ['marketing', 'seo', 'social-media'],
        whatsIncluded: ['Video lessons', 'PDF guides', 'Templates'],
        requirements: ['Basic computer skills'],
        status: ProductStatus.APPROVED,
        featured: true,
        bestseller: true,
        rating: 4.8,
        reviewCount: 234,
        downloadCount: 1523,
        publishedAt: new Date(),
      },
    });

    await prisma.product.create({
      data: {
        title: 'Productivity Planner & Goal Setting System',
        slug: 'productivity-planner-goal-setting',
        description: 'Transform your life with this comprehensive productivity system. Includes planners, templates, and guides.',
        shortDescription: 'Boost your productivity and achieve your goals',
        price: 29.99,
        categoryId: personalCategory.id,
        vendorId: vendor.vendorProfile!.id,
        fileUrl: 'https://example.com/files/productivity-planner.pdf',
        fileName: 'productivity-planner.pdf',
        fileSize: 15728640,
        fileType: 'pdf',
        thumbnailUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b',
        previewImages: ['https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b'],
        tags: ['productivity', 'planning', 'goals'],
        whatsIncluded: ['PDF planner', 'Goal templates', 'Tracking sheets'],
        requirements: ['PDF reader'],
        status: ProductStatus.APPROVED,
        featured: true,
        bestseller: false,
        newArrival: true,
        rating: 4.9,
        reviewCount: 445,
        downloadCount: 3421,
        publishedAt: new Date(),
      },
    });

    await prisma.product.create({
      data: {
        title: 'Full Stack Web Development Course',
        slug: 'full-stack-web-development-course',
        description: 'Learn to build modern web applications with React, Node.js, and MongoDB. Complete with projects and exercises.',
        shortDescription: 'Become a full stack developer',
        price: 79.99,
        categoryId: techCategory.id,
        vendorId: vendor.vendorProfile!.id,
        fileUrl: 'https://example.com/files/web-dev-course.zip',
        fileName: 'web-dev-course.zip',
        fileSize: 1073741824,
        fileType: 'zip',
        thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
        previewImages: ['https://images.unsplash.com/photo-1498050108023-c5249f4df085'],
        tags: ['web-development', 'react', 'nodejs'],
        whatsIncluded: ['Video tutorials', 'Source code', 'Project files'],
        requirements: ['Basic programming knowledge'],
        status: ProductStatus.APPROVED,
        featured: true,
        bestseller: true,
        newArrival: true,
        rating: 4.7,
        reviewCount: 567,
        downloadCount: 2134,
        publishedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        categories: 3,
        products: 3,
        users: 2,
      },
    });
  } catch (error: any) {
    console.error('Seeding error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed database',
    });
  }
});

// One-time setup endpoint - creates admin if no users exist
router.get('/initialize', async (req, res) => {
  try {
    // Check if any users exist
    const userCount = await prisma.user.count();

    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Database already initialized. Users exist.',
      });
    }

    // Create default admin user
    const email = 'admin@digistore1.com';
    const password = 'Admin123!';
    const name = 'Admin User';
    const hashedPassword = await hashPassword(password);

    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      credentials: {
        email,
        password,
        note: 'Please change this password after first login!',
      },
    });
  } catch (error: any) {
    console.error('Initialization error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize database',
    });
  }
});

// Special endpoint to create admin user (should be disabled in production)
router.post('/create-admin', async (req, res) => {
  try {
    const { email, password, name, secretKey } = req.body;

    // Simple security check - require a secret key (if set in environment)
    const requiredSecret = process.env.ADMIN_SETUP_SECRET;
    if (requiredSecret && secretKey !== requiredSecret) {
      return res.status(403).json({
        success: false,
        message: 'Invalid secret key',
      });
    }

    // Check if admin already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      // Update to admin if exists
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { 
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: 'User updated to ADMIN role',
        data: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
        },
      });
    }

    // Create new admin user
    const hashedPassword = await hashPassword(password);

    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error: any) {
    console.error('Admin creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create admin user',
    });
  }
});

export default router;

