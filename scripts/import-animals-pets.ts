/**
 * Import Animals & Pets eBooks to Digistore1
 * Uploads PDFs to Cloudinary and creates products DIRECTLY in database
 */

import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'diyj7ibcz',
  api_key: '165774748314148',
  api_secret: 'jV0AimbMSA9YDUO7upTRv2CNs70',
});

// ============ UPDATE THESE FOR EACH IMPORT ============
const SOURCE_DIR = '/Volumes/Raid1/Users/raidf/Downloads/ALL ABOUT DOGS';
const CATEGORY_NAME = 'All About Dogs';
const CATEGORY_SLUG = 'all-about-dogs';
const CLOUDINARY_FOLDER = 'digistore1/ebooks/all-about-dogs';
// =======================================================

function cleanProductName(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

async function uploadToCloudinary(filePath: string): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: CLOUDINARY_FOLDER,
    resource_type: 'auto',
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

function generatePdfThumbnail(pdfUrl: string): string {
  return pdfUrl
    .replace('/upload/', '/upload/w_400,h_550,c_fill,pg_1,f_jpg/')
    .replace('.pdf', '.jpg');
}

async function findOrCreateCategory(): Promise<string> {
  // First try to find existing category
  let category = await prisma.category.findUnique({
    where: { slug: CATEGORY_SLUG },
  });

  if (!category) {
    // Create category directly in database
    category = await prisma.category.create({
      data: {
        name: CATEGORY_NAME,
        slug: CATEGORY_SLUG,
        description: `Free eBooks about ${CATEGORY_NAME.toLowerCase()}`,
        image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400',
      },
    });
    console.log(`✅ Created category: ${CATEGORY_NAME}`);
  } else {
    console.log(`✅ Found existing category: ${CATEGORY_NAME}`);
  }

  return category.id;
}

async function getOrCreateVendor(): Promise<string> {
  // Find admin user
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    include: { vendorProfile: true },
  });

  if (!admin) {
    throw new Error('No admin user found');
  }

  if (admin.vendorProfile) {
    return admin.vendorProfile.id;
  }

  // Check if DigiStore Official vendor exists
  let vendor = await prisma.vendorProfile.findFirst({
    where: { businessName: 'DigiStore Official' },
  });

  if (!vendor) {
    vendor = await prisma.vendorProfile.create({
      data: {
        userId: admin.id,
        businessName: 'DigiStore Official',
        description: 'Official DigiStore products',
        verified: true,
        autoApproveProducts: true,
      },
    });
  }

  return vendor.id;
}

function findAllPdfs(dir: string): string[] {
  const pdfs: string[] = [];

  function scanDir(currentDir: string) {
    try {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (item.toLowerCase().endsWith('.pdf') && !item.startsWith('.')) {
          pdfs.push(fullPath);
        }
      }
    } catch (e) {
      // Skip directories we can't read
    }
  }

  scanDir(dir);
  return pdfs;
}

async function main() {
  console.log('\n========================================');
  console.log('EBOOK IMPORT (Direct Database Mode)');
  console.log('========================================\n');

  const categoryId = await findOrCreateCategory();
  console.log(`Category ID: ${categoryId}\n`);

  const vendorId = await getOrCreateVendor();
  console.log(`Vendor ID: ${vendorId}\n`);

  const pdfFiles = findAllPdfs(SOURCE_DIR);
  console.log(`Found ${pdfFiles.length} PDF files\n`);

  let imported = 0, skipped = 0, failed = 0;

  for (const filePath of pdfFiles) {
    const fileName = path.basename(filePath);
    const productName = cleanProductName(fileName);
    const slug = generateSlug(productName);

    console.log(`[${imported + skipped + failed + 1}/${pdfFiles.length}] ${fileName}`);

    try {
      // Check if product already exists
      const existing = await prisma.product.findUnique({
        where: { slug },
      });

      if (existing) {
        console.log(`  ⏭️  Skipped (exists)`);
        skipped++;
        continue;
      }

      console.log(`  Uploading to Cloudinary...`);
      const upload = await uploadToCloudinary(filePath);
      const thumbnailUrl = generatePdfThumbnail(upload.url);
      const fileSize = fs.statSync(filePath).size;

      console.log(`  Creating product in database...`);
      await prisma.product.create({
        data: {
          title: productName,
          slug,
          description: `Digital eBook: ${productName}. A comprehensive guide with valuable information. Instant download after purchase.`,
          price: 0,
          categoryId,
          vendorId,
          thumbnailUrl,
          fileUrl: upload.url,
          fileType: 'pdf',
          fileName: fileName,
          fileSize: BigInt(fileSize),
          status: ProductStatus.APPROVED,
          tags: [],
          previewImages: [],
          whatsIncluded: ['Full eBook PDF'],
          requirements: [],
        },
      });

      console.log(`  ✅ Imported: ${productName}`);
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

  await prisma.$disconnect();
}

main().catch(console.error);

