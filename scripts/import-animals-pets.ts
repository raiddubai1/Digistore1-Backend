/**
 * Import Animals & Pets eBooks to Digistore1
 * Uploads PDFs to Cloudinary and creates products via API
 */

import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'diyj7ibcz',
  api_key: '165774748314148',
  api_secret: 'jV0AimbMSA9YDUO7upTRv2CNs70',
});

const SOURCE_DIR = '/Volumes/SallnyHD/Digistore1/temp_import/animals_pets';
const API_URL = 'https://digistore1-backend.onrender.com/api';

// You need to get this token by logging in as admin
let ADMIN_TOKEN = '';

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
    folder: 'digistore1/ebooks/animals-pets',
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

async function loginAsAdmin(): Promise<string> {
  console.log('Logging in as admin...');
  const res = await axios.post(`${API_URL}/auth/login`, {
    email: 'admin@digistore1.com',
    password: 'admin123!',
  });
  return res.data.data.accessToken;
}

async function findOrCreateCategory(token: string): Promise<string> {
  // First try to find existing category
  const res = await axios.get(`${API_URL}/categories`);
  const responseData = res.data.data || res.data;
  const categories = Array.isArray(responseData) ? responseData : (responseData.categories || []);

  let category = categories.find((c: any) => c.slug === 'animals-pets');

  if (!category) {
    // Create category - POST /api/categories (not /admin/categories)
    const createRes = await axios.post(`${API_URL}/categories`, {
      name: 'Animals & Pets',
      slug: 'animals-pets',
      description: 'eBooks about pets, animals, dog training, cat care, and more',
      image: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=400',
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Handle different response formats
    category = createRes.data.data || createRes.data.category || createRes.data;
    console.log('✅ Created category: Animals & Pets');
    console.log('Category response:', JSON.stringify(createRes.data, null, 2));
  } else {
    console.log('✅ Found existing category: Animals & Pets');
  }

  if (!category || !category.id) {
    // Re-fetch categories to get the newly created one
    const refetchRes = await axios.get(`${API_URL}/categories`);
    const refetchData = refetchRes.data.data || refetchRes.data;
    const allCategories = Array.isArray(refetchData) ? refetchData : (refetchData.categories || []);
    category = allCategories.find((c: any) => c.slug === 'animals-pets');
  }

  if (!category || !category.id) {
    throw new Error('Failed to get category ID');
  }

  return category.id;
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

async function createProduct(token: string, data: any): Promise<boolean> {
  try {
    // POST /api/admin/products - admin endpoint for bulk imports
    await axios.post(`${API_URL}/admin/products`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return true;
  } catch (error: any) {
    if (error.response?.status === 409 || error.response?.data?.message?.includes('exists')) {
      return false; // Already exists
    }
    // Log detailed error
    if (error.response) {
      console.log(`    Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('ANIMALS & PETS IMPORT (API Mode)');
  console.log('========================================\n');

  // Login to get token
  ADMIN_TOKEN = await loginAsAdmin();
  console.log('✅ Logged in as admin\n');

  const categoryId = await findOrCreateCategory(ADMIN_TOKEN);
  console.log(`Category ID: ${categoryId}\n`);

  const pdfFiles = findAllPdfs(SOURCE_DIR);
  console.log(`Found ${pdfFiles.length} PDF files\n`);

  let imported = 0, skipped = 0, failed = 0;

  for (const filePath of pdfFiles) {
    const fileName = path.basename(filePath);
    const productName = cleanProductName(fileName);
    const slug = generateSlug(productName);

    console.log(`[${imported + skipped + failed + 1}/${pdfFiles.length}] ${fileName}`);

    try {
      console.log(`  Uploading to Cloudinary...`);
      const upload = await uploadToCloudinary(filePath);
      const thumbnailUrl = generatePdfThumbnail(upload.url);
      const fileSize = fs.statSync(filePath).size;

      console.log(`  Creating product...`);
      const created = await createProduct(ADMIN_TOKEN, {
        title: productName,
        slug,
        description: `Digital eBook: ${productName}. Learn about pets and animals with this comprehensive guide. Instant download after purchase.`,
        shortDescription: `${productName} - Digital eBook`,
        price: 0,
        originalPrice: 0,
        categoryId,
        thumbnailUrl,
        previewImages: [thumbnailUrl],
        fileUrl: upload.url,
        fileName,
        fileType: 'PDF',
        fileSize,
        status: 'APPROVED',
        featured: false,
        bestseller: false,
        newArrival: true,
      });

      if (created) {
        console.log(`  ✅ Imported: ${productName}`);
        imported++;
      } else {
        console.log(`  ⏭️  Skipped (exists)`);
        skipped++;
      }
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
}

main().catch(console.error);

