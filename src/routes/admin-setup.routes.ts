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
      // Update to admin if exists - also update password if provided
      const updateData: any = {
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      };

      // Update password if provided
      if (password) {
        updateData.password = await hashPassword(password);
      }

      // Update name if provided
      if (name) {
        updateData.name = name;
      }

      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: updateData,
      });

      return res.json({
        success: true,
        message: password ? 'Admin updated with new password' : 'User updated to ADMIN role',
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

// Reset admin password endpoint
router.post('/reset-admin-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email and newPassword are required',
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        email,
        note: 'You can now login with your new password',
      },
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reset password',
    });
  }
});

// Clear all products endpoint - useful for re-seeding
router.delete('/clear-products', async (req, res) => {
  try {
    const result = await prisma.product.deleteMany({});

    res.json({
      success: true,
      message: `Deleted ${result.count} products`,
      data: { deletedCount: result.count },
    });
  } catch (error: any) {
    console.error('Clear products error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to clear products',
    });
  }
});

// Setup vendor profile for admin user - allows admin to create products
router.post('/setup-admin-vendor', async (req, res) => {
  try {
    const { email, businessName } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { vendorProfile: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if vendor profile already exists
    if (user.vendorProfile) {
      return res.json({
        success: true,
        message: 'Vendor profile already exists',
        data: { vendorProfile: user.vendorProfile },
      });
    }

    // Create vendor profile
    const vendorProfile = await prisma.vendorProfile.create({
      data: {
        userId: user.id,
        businessName: businessName || 'Digistore1 Admin',
        businessEmail: email,
        description: 'Official store products',
        autoApproveProducts: true, // Admin products auto-approved
      },
    });

    res.status(201).json({
      success: true,
      message: 'Vendor profile created successfully',
      data: { vendorProfile },
    });
  } catch (error: any) {
    console.error('Setup admin vendor error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to setup admin vendor',
    });
  }
});

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    });

    res.json({
      success: true,
      data: { categories },
    });
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get categories',
    });
  }
});

// Create category
router.post('/categories', async (req, res) => {
  try {
    const { name, slug, description, icon, image, order } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Name and slug are required',
      });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        icon,
        image,
        order: order || 0,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  } catch (error: any) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create category',
    });
  }
});

// Import from WooCommerce API
router.post('/import-woocommerce', async (req, res) => {
  try {
    const { woocommerceUrl, consumerKey, consumerSecret, adminEmail } = req.body;

    if (!woocommerceUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({
        success: false,
        message: 'woocommerceUrl, consumerKey, and consumerSecret are required',
      });
    }

    // Find vendor profile
    const user = await prisma.user.findUnique({
      where: { email: adminEmail || 'admin@digistore1.com' },
      include: { vendorProfile: true },
    });

    if (!user?.vendorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found. Run /setup-admin-vendor first.',
      });
    }

    const vendorId = user.vendorProfile.id;
    const results = { created: 0, skipped: 0, failed: 0, errors: [] as string[] };

    // Fetch products from WooCommerce
    let page = 1;
    const perPage = 100;

    while (true) {
      const url = `${woocommerceUrl}/wp-json/wc/v3/products?page=${page}&per_page=${perPage}&status=publish`;

      const response = await fetch(url, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64'),
        },
      });

      if (!response.ok) {
        throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
      }

      const products = await response.json() as any[];

      if (!products || !Array.isArray(products) || products.length === 0) {
        break;
      }

      for (const wooProduct of products) {
        try {
          // Generate slug
          let slug = wooProduct.slug || wooProduct.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

          // Check if already exists
          const existing = await prisma.product.findUnique({ where: { slug } });
          if (existing) {
            results.skipped++;
            continue;
          }

          // Get or create category
          let categoryId: string;
          const wooCategory = wooProduct.categories?.[0];
          if (wooCategory) {
            const catSlug = wooCategory.slug || wooCategory.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');

            let category = await prisma.category.findUnique({ where: { slug: catSlug } });
            if (!category) {
              category = await prisma.category.create({
                data: {
                  name: wooCategory.name,
                  slug: catSlug,
                  description: `Products in ${wooCategory.name}`,
                },
              });
            }
            categoryId = category.id;
          } else {
            let uncategorized = await prisma.category.findUnique({ where: { slug: 'uncategorized' } });
            if (!uncategorized) {
              uncategorized = await prisma.category.create({
                data: { name: 'Uncategorized', slug: 'uncategorized', description: 'Uncategorized products' },
              });
            }
            categoryId = uncategorized.id;
          }

          // Strip HTML from description
          const stripHtml = (html: string) => html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();

          const price = parseFloat(wooProduct.price) || 0;
          const regularPrice = parseFloat(wooProduct.regular_price) || price;
          const discount = regularPrice > price ? Math.round((1 - price / regularPrice) * 100) : 0;

          await prisma.product.create({
            data: {
              title: wooProduct.name,
              slug,
              description: stripHtml(wooProduct.description || wooProduct.name),
              shortDescription: stripHtml(wooProduct.short_description || ''),
              price,
              originalPrice: regularPrice > price ? regularPrice : null,
              discount,
              categoryId,
              tags: wooProduct.tags?.map((t: any) => t.name) || [],
              fileType: wooProduct.downloadable ? 'pdf' : 'digital',
              fileUrl: wooProduct.downloads?.[0]?.file || '',
              fileName: wooProduct.downloads?.[0]?.name || 'product-file',
              thumbnailUrl: wooProduct.images?.[0]?.src || '',
              previewImages: wooProduct.images?.map((img: any) => img.src) || [],
              featured: wooProduct.featured || false,
              bestseller: (wooProduct.total_sales || 0) > 10,
              newArrival: true,
              status: ProductStatus.APPROVED,
              vendorId,
              rating: parseFloat(wooProduct.average_rating) || 0,
              reviewCount: wooProduct.rating_count || 0,
              downloadCount: wooProduct.total_sales || 0,
              publishedAt: new Date(wooProduct.date_created || new Date()),
            },
          });

          results.created++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`${wooProduct.name}: ${err.message}`);
        }
      }

      page++;
    }

    res.status(201).json({
      success: true,
      message: `WooCommerce import complete: ${results.created} created, ${results.skipped} skipped, ${results.failed} failed`,
      data: results,
    });
  } catch (error: any) {
    console.error('WooCommerce import error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to import from WooCommerce',
    });
  }
});

// Bulk import products (for WooCommerce migration)
router.post('/import-products', async (req, res) => {
  try {
    const { products, vendorEmail } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: 'Products array is required',
      });
    }

    // Find vendor profile
    const user = await prisma.user.findUnique({
      where: { email: vendorEmail || 'admin@digistore1.com' },
      include: { vendorProfile: true },
    });

    if (!user?.vendorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found. Run /setup-admin-vendor first.',
      });
    }

    const vendorId = user.vendorProfile.id;
    const results = { created: 0, failed: 0, errors: [] as string[] };

    for (const product of products) {
      try {
        // Generate unique slug
        let slug = product.slug || product.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        // Check if slug exists, append number if so
        const existingSlug = await prisma.product.findUnique({ where: { slug } });
        if (existingSlug) {
          slug = `${slug}-${Date.now()}`;
        }

        // Find or create category
        let categoryId = product.categoryId;
        if (!categoryId && product.categoryName) {
          const categorySlug = product.categoryName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

          let category = await prisma.category.findUnique({ where: { slug: categorySlug } });
          if (!category) {
            category = await prisma.category.create({
              data: {
                name: product.categoryName,
                slug: categorySlug,
                description: `Products in ${product.categoryName}`,
              },
            });
          }
          categoryId = category.id;
        }

        // Use default category if none specified
        if (!categoryId) {
          let defaultCategory = await prisma.category.findUnique({ where: { slug: 'uncategorized' } });
          if (!defaultCategory) {
            defaultCategory = await prisma.category.create({
              data: {
                name: 'Uncategorized',
                slug: 'uncategorized',
                description: 'Uncategorized products',
              },
            });
          }
          categoryId = defaultCategory.id;
        }

        await prisma.product.create({
          data: {
            title: product.title || product.name,
            slug,
            description: product.description || '',
            shortDescription: product.shortDescription || product.short_description || '',
            price: parseFloat(product.price) || 0,
            originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : null,
            discount: product.discount || 0,
            categoryId,
            subcategory: product.subcategory || null,
            tags: product.tags || [],
            fileType: product.fileType || 'pdf',
            fileSize: product.fileSize ? BigInt(product.fileSize) : null,
            fileUrl: product.fileUrl || product.downloadUrl || '',
            fileName: product.fileName || 'product-file',
            thumbnailUrl: product.thumbnailUrl || product.image || product.images?.[0] || '',
            previewImages: product.previewImages || product.images || [],
            whatsIncluded: product.whatsIncluded || [],
            requirements: product.requirements || [],
            featured: product.featured || false,
            bestseller: product.bestseller || false,
            newArrival: product.newArrival || true,
            status: ProductStatus.APPROVED,
            vendorId,
            rating: product.rating || 0,
            reviewCount: product.reviewCount || 0,
            downloadCount: product.downloadCount || 0,
            publishedAt: new Date(),
          },
        });

        results.created++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${product.title}: ${err.message}`);
      }
    }

    res.status(201).json({
      success: true,
      message: `Imported ${results.created} products, ${results.failed} failed`,
      data: results,
    });
  } catch (error: any) {
    console.error('Import products error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to import products',
    });
  }
});

export default router;

