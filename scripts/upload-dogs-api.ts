/**
 * Fix thumbnails for ALL ABOUT DOGS products - extract first page from PDFs
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

// Upload PDF as 'image' type to enable page extraction for thumbnails
async function uploadPdfForThumbnail(filePath: string, slug: string): Promise<string> {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'digistore1/thumbnails/dogs',
    resource_type: 'image', // This allows Cloudinary to extract pages
    public_id: `thumb-${slug}`,
    overwrite: true,
    format: 'jpg',
    transformation: [
      { page: 1 },           // Get first page
      { width: 400, height: 550, crop: 'fill' }
    ]
  });
  return result.secure_url;
}

async function main() {
  console.log('\n========================================');
  console.log('FIXING THUMBNAILS FOR DOG EBOOKS');
  console.log('========================================\n');

  // Get all products in the category
  console.log('Fetching existing products...');
  const prodResponse = await fetch(`${API_BASE}/products?categoryId=${CATEGORY_ID}&limit=200`);
  const prodData = await prodResponse.json();
  const existingProducts = prodData.data?.products || [];
  console.log(`Found ${existingProducts.length} products in database\n`);

  // Get local PDF files
  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`Found ${files.length} PDF files locally\n`);

  const updates: { id: string; thumbnailUrl: string }[] = [];
  let processed = 0, skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(SOURCE_DIR, filename);
    const fileSize = fs.statSync(filePath).size;
    const title = cleanProductName(filename);
    const slug = generateSlug(title);

    console.log(`[${i + 1}/${files.length}] ${title}`);

    // Find matching product in database
    const product = existingProducts.find((p: any) =>
      p.slug === slug ||
      p.title.toLowerCase() === title.toLowerCase() ||
      p.slug.includes(slug.substring(0, 20))
    );

    if (!product) {
      console.log(`  ⏭️ No matching product found`);
      skipped++;
      continue;
    }

    if (fileSize > MAX_FILE_SIZE) {
      console.log(`  ⏭️ Skipped (file too large: ${(fileSize / 1024 / 1024).toFixed(1)}MB)`);
      skipped++;
      continue;
    }

    try {
      console.log(`  📤 Generating thumbnail from PDF...`);
      const thumbnailUrl = await uploadPdfForThumbnail(filePath, slug);
      console.log(`  ✅ Thumbnail: ${thumbnailUrl.substring(0, 60)}...`);

      updates.push({ id: product.id, thumbnailUrl });
      processed++;
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      skipped++;
    }
  }

  console.log(`\n📦 Generated ${processed} thumbnails, skipped ${skipped}`);

  if (updates.length > 0) {
    console.log(`\n📝 Updating ${updates.length} products with new thumbnails...`);

    // Update via bulk-update endpoint
    const response = await fetch(`${API_BASE}/products/bulk-update-thumbnails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: IMPORT_SECRET, updates }),
    });

    const result = await response.json();
    console.log('\n========================================');
    console.log('UPDATE RESULT:');
    console.log(JSON.stringify(result, null, 2));
    console.log('========================================\n');
  }
}

main().catch(console.error);

