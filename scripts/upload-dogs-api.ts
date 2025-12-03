/**
 * Upload ALL ABOUT DOGS eBooks to Cloudinary and create products via API
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

function cleanProductName(filename: string): string {
  let name = filename.replace(/\.pdf$/i, '');
  // Add spaces before capital letters
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Replace underscores and hyphens
  name = name.replace(/[-_]/g, ' ');
  // Clean multiple spaces
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

async function uploadToCloudinary(filePath: string): Promise<string> {
  const slug = generateSlug(path.basename(filePath, '.pdf'));
  console.log(`  📤 Uploading to Cloudinary...`);
  
  const result = await cloudinary.uploader.upload(filePath, {
    folder: CLOUDINARY_FOLDER,
    resource_type: 'raw',
    public_id: slug,
    overwrite: true,
  });
  
  return result.secure_url;
}

async function createProduct(title: string, slug: string, fileUrl: string, fileSize: number): Promise<boolean> {
  const payload = {
    title,
    slug,
    description: `Free eBook: ${title}. This comprehensive guide covers everything you need to know about dogs, from training tips to health care advice.`,
    price: 0,
    categoryId: CATEGORY_ID,
    fileUrl,
    fileType: 'pdf',
    fileSize,
    status: 'APPROVED',
    featured: false,
    thumbnailUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
  };

  const response = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    console.log(`  ✅ Created product`);
    return true;
  } else {
    const error = await response.text();
    console.log(`  ❌ Failed: ${error}`);
    return false;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('UPLOADING DOG EBOOKS');
  console.log('========================================\n');

  // Get PDF files only
  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'));
  
  console.log(`Found ${files.length} PDF files\n`);

  let success = 0, failed = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(SOURCE_DIR, filename);
    const fileSize = fs.statSync(filePath).size;
    const title = cleanProductName(filename);
    const slug = generateSlug(title);

    console.log(`[${i + 1}/${files.length}] ${title}`);

    try {
      const fileUrl = await uploadToCloudinary(filePath);
      const created = await createProduct(title, slug, fileUrl, fileSize);
      if (created) success++;
      else failed++;
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`DONE! ✅ Success: ${success}, ❌ Failed: ${failed}`);
  console.log('========================================\n');
}

main().catch(console.error);

