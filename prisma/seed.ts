import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Business and Marketing',
        slug: 'business-and-marketing',
        description: 'eBooks on business strategies, marketing, and entrepreneurship',
        icon: 'briefcase',
        order: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Personal Development',
        slug: 'personal-development',
        description: 'Self-improvement, relationships, and personal growth',
        icon: 'user',
        order: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Technology',
        slug: 'technology',
        description: 'Programming, software development, and tech guides',
        icon: 'code',
        order: 3,
      },
    }),
  ]);

  console.log('✅ Categories created');

  // Create admin user
  const adminPassword = await hashPassword('admin123456');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@digistore1.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  console.log('✅ Admin user created');

  // Create vendor user
  const vendorPassword = await hashPassword('vendor123456');
  const vendor = await prisma.user.create({
    data: {
      email: 'vendor@example.com',
      password: vendorPassword,
      name: 'Demo Vendor',
      role: 'VENDOR',
      status: 'ACTIVE',
      emailVerified: true,
      vendorProfile: {
        create: {
          businessName: 'Demo Digital Products',
          businessEmail: 'vendor@example.com',
          description: 'High-quality digital products for professionals',
          autoApproveProducts: true,
        },
      },
    },
    include: {
      vendorProfile: true,
    },
  });

  console.log('✅ Vendor user created');

  // Create customer user
  const customerPassword = await hashPassword('customer123456');
  const customer = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      password: customerPassword,
      name: 'Demo Customer',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerified: true,
      customerProfile: {
        create: {},
      },
    },
  });

  console.log('✅ Customer user created');

  // Create demo products
  if (vendor.vendorProfile) {
    const products = await Promise.all([
      prisma.product.create({
        data: {
          title: 'The Complete Guide to Digital Marketing',
          slug: 'complete-guide-digital-marketing',
          description: 'Master digital marketing strategies including SEO, social media, email marketing, and content creation.',
          shortDescription: 'Master digital marketing from SEO to social media',
          price: 29.99,
          originalPrice: 49.99,
          discount: 40,
          categoryId: categories[0].id,
          subcategory: 'Digital Marketing',
          tags: ['marketing', 'seo', 'social-media'],
          fileType: 'pdf',
          fileSize: BigInt(12500000),
          fileUrl: '/downloads/digital-marketing-guide.pdf',
          fileName: 'digital-marketing-guide.pdf',
          thumbnailUrl: '/products/marketing-thumb.jpg',
          previewImages: ['/products/marketing-1.jpg'],
          whatsIncluded: ['250-page eBook', '30+ case studies', 'Marketing templates'],
          requirements: ['PDF reader'],
          vendorId: vendor.vendorProfile.id,
          status: 'APPROVED',
          featured: true,
          bestseller: true,
          rating: 4.8,
          reviewCount: 234,
          downloadCount: 1567,
          publishedAt: new Date(),
        },
      }),
      prisma.product.create({
        data: {
          title: 'Python Programming for Beginners',
          slug: 'python-programming-beginners',
          description: 'Learn Python from scratch with hands-on examples and projects.',
          shortDescription: 'Start your Python programming journey',
          price: 34.99,
          originalPrice: 59.99,
          discount: 42,
          categoryId: categories[2].id,
          subcategory: 'Programming',
          tags: ['python', 'programming', 'coding'],
          fileType: 'pdf',
          fileSize: BigInt(15300000),
          fileUrl: '/downloads/python-guide.pdf',
          fileName: 'python-guide.pdf',
          thumbnailUrl: '/products/python-thumb.jpg',
          previewImages: ['/products/python-1.jpg'],
          whatsIncluded: ['300-page guide', '50+ code examples', '10 projects'],
          requirements: ['PDF reader'],
          vendorId: vendor.vendorProfile.id,
          status: 'APPROVED',
          featured: true,
          bestseller: true,
          rating: 4.9,
          reviewCount: 445,
          downloadCount: 3421,
          publishedAt: new Date(),
        },
      }),
    ]);

    console.log('✅ Demo products created');
  }

  console.log('🎉 Seeding completed!');
  console.log('\n📧 Demo Accounts:');
  console.log('Admin: admin@digistore1.com / admin123456');
  console.log('Vendor: vendor@example.com / vendor123456');
  console.log('Customer: customer@example.com / customer123456');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

