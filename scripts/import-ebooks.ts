import { PrismaClient, ProductStatus } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface ImportConfig {
  sourceDir: string;
  categoryPath: string[]; // e.g., ['eBooks', 'Business', 'Marketing', 'Affiliate Marketing']
  vendorId: string; // Required vendor ID
}

function cleanProductName(filename: string): string {
  // Remove file extension
  let name = filename.replace(/\.pdf$/i, '');
  // Replace underscores and hyphens with spaces
  name = name.replace(/[_-]/g, ' ');
  // Remove multiple spaces
  name = name.replace(/\s+/g, ' ').trim();
  // Title case
  name = name.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
  return name;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

async function ensureCategoryPath(categoryPath: string[]): Promise<string> {
  let parentId: string | null = null;
  let lastCategoryId: string = '';

  for (let i = 0; i < categoryPath.length; i++) {
    const categoryName = categoryPath[i];
    const slug = generateSlug(categoryName);

    // Check if category exists by slug (slugs are unique globally)
    const existingCategory: { id: string; name: string; parentId: string | null } | null = await prisma.category.findUnique({
      where: { slug: slug },
      select: { id: true, name: true, parentId: true },
    });

    let categoryId: string;

    if (!existingCategory) {
      // Create the category
      const newCategory = await prisma.category.create({
        data: {
          name: categoryName,
          slug: slug,
          description: `${categoryName} digital products`,
          parentId: parentId,
          image: '',
        },
      });
      console.log(`  Created category: ${categoryName}`);
      categoryId = newCategory.id;
    } else {
      console.log(`  Found existing category: ${existingCategory.name}`);
      categoryId = existingCategory.id;
    }

    parentId = categoryId;
    lastCategoryId = categoryId;
  }

  return lastCategoryId;
}

async function uploadToCloudinary(filePath: string, folder: string): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: `digistore1/${folder}`,
    resource_type: 'auto',
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

async function generatePdfThumbnail(pdfUrl: string): Promise<string> {
  // Cloudinary can generate thumbnails from PDFs by changing the extension
  // and adding page parameter
  const thumbnailUrl = pdfUrl
    .replace('/upload/', '/upload/w_400,h_550,c_fill,pg_1,f_jpg/')
    .replace('.pdf', '.jpg');
  return thumbnailUrl;
}

async function importEbooks(config: ImportConfig) {
  const { sourceDir, categoryPath, vendorId } = config;
  
  console.log('\n========================================');
  console.log('EBOOK IMPORT SCRIPT');
  console.log('========================================\n');

  // Ensure Cloudinary is configured
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('CLOUDINARY_CLOUD_NAME not set');
  }

  console.log(`Source directory: ${sourceDir}`);
  console.log(`Category path: ${categoryPath.join(' > ')}\n`);

  // Create category hierarchy
  console.log('Creating category hierarchy...');
  const categoryId = await ensureCategoryPath(categoryPath);
  console.log(`Category ID: ${categoryId}\n`);

  // Get all PDF files
  const files = fs.readdirSync(sourceDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`Found ${files.length} PDF files\n`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const productName = cleanProductName(file);
    const slug = generateSlug(productName);

    console.log(`\n[${imported + skipped + failed + 1}/${files.length}] Processing: ${file}`);
    console.log(`  Name: ${productName}`);
    console.log(`  Slug: ${slug}`);

    // Check if product already exists
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      console.log(`  ⏭️  Skipped (already exists)`);
      skipped++;
      continue;
    }

    try {
      // Upload PDF to Cloudinary
      console.log(`  Uploading PDF...`);
      const pdfUpload = await uploadToCloudinary(filePath, 'ebooks');
      console.log(`  ✅ PDF uploaded: ${pdfUpload.publicId}`);

      // Generate thumbnail URL from the PDF
      const thumbnailUrl = await generatePdfThumbnail(pdfUpload.url);
      console.log(`  ✅ Thumbnail generated`);

      // Get file size in bytes
      const fileSizeBytes = BigInt(fs.statSync(filePath).size);

      // Create product in database
      const product = await prisma.product.create({
        data: {
          title: productName,
          slug: slug,
          description: `Digital eBook: ${productName}. Instant download after purchase.`,
          shortDescription: `${productName} - Digital eBook`,
          price: 0, // User will set prices later
          originalPrice: 0,
          categoryId: categoryId,
          thumbnailUrl: thumbnailUrl,
          previewImages: [thumbnailUrl],
          fileUrl: pdfUpload.url,
          fileName: file,
          fileType: 'PDF',
          fileSize: fileSizeBytes,
          status: ProductStatus.APPROVED,
          featured: false,
          bestseller: false,
          newArrival: true,

          vendorId: vendorId,
        },
      });

      console.log(`  ✅ Product created: ${product.id}`);
      imported++;
    } catch (error: any) {
      console.log(`  ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('========================================');
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${files.length}`);
}

// Run the import
const config: ImportConfig = {
  sourceDir: '/Volumes/SallnyHD/Digistore1/temp_import/extracted/AFFILIATE MARKETING I',
  categoryPath: ['eBooks', 'Business', 'Marketing', 'Affiliate Marketing'],
  vendorId: 'cmik49t660001ib3gxxlcobw5', // Platform vendor ID
};

importEbooks(config)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

