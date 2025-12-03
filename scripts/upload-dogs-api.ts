/**
 * Upload ALL ABOUT DOGS eBooks to Cloudinary and create products via bulk import API
 */

import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

// Configure Cloudinary - CORRECT ACCOUNT
cloudinary.config({
  cloud_name: 'dnb29pk8j',
  api_key: '319936465742415',
  api_secret: 'gXqwvM5yGAVUJufLKS0u5hkcZjU',
});

const SOURCE_DIR = '/Volumes/Raid1/Users/raidf/Downloads/ALL ABOUT DOGS';
const CATEGORY_ID = 'cmilryhjn000zea2yj73v29us'; // All About Dogs
const API_BASE = 'https://digistore1-backend.onrender.com/api';
const CLOUDINARY_FOLDER = 'digistore1/ebooks/all-about-dogs';
const IMPORT_SECRET = 'digistore1-bulk-import-2024';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function cleanProductName(filename: string): string {
  let name = filename.replace(/\.pdf$/i, '');
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  name = name.replace(/[-_]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
}

async function uploadToCloudinary(filePath: string): Promise<string> {
  const slug = generateSlug(path.basename(filePath, '.pdf'));
  const result = await cloudinary.uploader.upload(filePath, {
    folder: CLOUDINARY_FOLDER,
    resource_type: 'raw',
    public_id: slug,
    overwrite: true,
  });
  return result.secure_url;
}

async function main() {
  console.log('\n========================================');
  console.log('UPLOADING DOG EBOOKS (Bulk Import)');
  console.log('========================================\n');

  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`Found ${files.length} PDF files\n`);

  const products: any[] = [];
  let uploaded = 0, skipped = 0;

  // Step 1: Upload all files to Cloudinary
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(SOURCE_DIR, filename);
    const fileSize = fs.statSync(filePath).size;
    const title = cleanProductName(filename);
    const slug = generateSlug(title);

    console.log(`[${i + 1}/${files.length}] ${title}`);

    if (fileSize > MAX_FILE_SIZE) {
      console.log(`  ⏭️ Skipped (file too large: ${(fileSize / 1024 / 1024).toFixed(1)}MB)`);
      skipped++;
      continue;
    }

    try {
      console.log(`  📤 Uploading to Cloudinary...`);
      const fileUrl = await uploadToCloudinary(filePath);
      console.log(`  ✅ Uploaded`);

      products.push({
        title,
        slug,
        description: `Free eBook: ${title}. A comprehensive guide about dogs covering training, health, and care tips.`,
        price: 0,
        categoryId: CATEGORY_ID,
        fileUrl,
        fileType: 'pdf',
        fileName: filename,
        fileSize,
        thumbnailUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
      });
      uploaded++;
    } catch (error: any) {
      console.log(`  ❌ Upload error: ${error.message}`);
      skipped++;
    }
  }

  console.log(`\n📦 Uploaded ${uploaded} files, skipped ${skipped}`);
  console.log(`\n📝 Creating ${products.length} products via bulk import API...`);

  // Step 2: Bulk import all products
  const response = await fetch(`${API_BASE}/products/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: IMPORT_SECRET, products }),
  });

  const result = await response.json();
  console.log('\n========================================');
  console.log('IMPORT RESULT:');
  console.log(JSON.stringify(result, null, 2));
  console.log('========================================\n');
}

main().catch(console.error);

