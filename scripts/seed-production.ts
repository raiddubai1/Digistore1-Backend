import { PrismaClient, ProductStatus } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding production database...');

  // Check if products already exist
  const productCount = await prisma.product.count();
  if (productCount > 0) {
    console.log('❌ Database already seeded. Products exist.');
    return;
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

  console.log('✅ Categories ready');

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

  console.log('✅ Vendor user ready');

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

  console.log('✅ Customer user ready');

  // Create demo products
  console.log('📦 Creating products...');

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

  console.log('✅ Products created');
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

