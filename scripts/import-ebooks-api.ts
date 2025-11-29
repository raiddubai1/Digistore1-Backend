/**
 * eBook Import Script - Uses API for database operations
 * 
 * This script:
 * 1. Reads PDFs from local extracted folder
 * 2. Uploads each PDF to Cloudinary
 * 3. Calls the production API to create products
 */

import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const API_URL = 'https://digistore1-backend.onrender.com/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // You'll need to set this

interface ImportConfig {
  sourceDir: string;
  categoryPath: string[];
}

function cleanProductName(filename: string): string {
  let name = filename.replace(/\.pdf$/i, '');
  name = name.replace(/[_-]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
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

async function uploadToCloudinary(filePath: string): Promise<{ url: string; publicId: string }> {
  console.log(`    Uploading to Cloudinary...`);
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'digistore1/ebooks',
    resource_type: 'auto',
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

function generatePdfThumbnail(pdfUrl: string): string {
  // Cloudinary can generate thumbnails from PDFs
  return pdfUrl
    .replace('/upload/', '/upload/w_400,h_550,c_fill,pg_1,f_jpg/')
    .replace('.pdf', '.jpg');
}

async function ensureCategory(categoryPath: string[]): Promise<string> {
  // First, try to get existing categories
  try {
    const response = await axios.get(`${API_URL}/categories`);
    const categories = response.data.data || [];
    
    // Find the deepest category that matches our path
    const lastCategoryName = categoryPath[categoryPath.length - 1];
    const slug = generateSlug(lastCategoryName);
    
    // Look for existing category
    const existing = categories.find((c: any) => c.slug === slug);
    if (existing) {
      console.log(`  Using existing category: ${existing.name} (${existing.id})`);
      return existing.id;
    }
  } catch (e) {
    console.log('  Could not fetch categories, will create new ones');
  }

  // If we need to create categories, we need admin token
  // For now, return a placeholder - we'll handle this differently
  console.log(`  Category not found - will need to create: ${categoryPath.join(' > ')}`);
  return '';
}

async function importEbooks(config: ImportConfig) {
  const { sourceDir, categoryPath } = config;
  
  console.log('\n========================================');
  console.log('EBOOK IMPORT SCRIPT (API Mode)');
  console.log('========================================\n');

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('CLOUDINARY_CLOUD_NAME not set. Check your .env file.');
  }

  console.log(`Source: ${sourceDir}`);
  console.log(`Category: ${categoryPath.join(' > ')}\n`);

  // Get all PDF files
  const files = fs.readdirSync(sourceDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`Found ${files.length} PDF files\n`);

  // Prepare import data
  const importData: any[] = [];
  let processed = 0;

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const productName = cleanProductName(file);
    const slug = generateSlug(productName);
    const fileSize = fs.statSync(filePath).size;

    console.log(`[${processed + 1}/${files.length}] ${file}`);
    console.log(`  Name: ${productName}`);

    try {
      // Upload to Cloudinary
      const upload = await uploadToCloudinary(filePath);
      const thumbnailUrl = generatePdfThumbnail(upload.url);

      importData.push({
        title: productName,
        slug: slug,
        description: `Digital eBook: ${productName}. Instant download after purchase.`,
        shortDescription: `${productName} - Digital eBook`,
        price: 0,
        categoryPath: categoryPath,
        thumbnailUrl: thumbnailUrl,
        images: [thumbnailUrl],
        fileUrl: upload.url,
        fileName: file,
        fileType: 'PDF',
        fileSize: fileSize,
      });

      console.log(`  ✅ Uploaded: ${upload.publicId}`);
      processed++;
    } catch (error: any) {
      console.log(`  ❌ Failed: ${error.message}`);
    }
  }

  // Save import data to JSON file for API import
  const outputPath = path.join(sourceDir, '..', 'import-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(importData, null, 2));
  
  console.log('\n========================================');
  console.log('UPLOAD COMPLETE');
  console.log('========================================');
  console.log(`✅ Processed: ${processed}/${files.length}`);
  console.log(`📄 Import data saved to: ${outputPath}`);
  console.log('\nNext: Run the database import on Render');
}

const config: ImportConfig = {
  sourceDir: '/Volumes/SallnyHD/Digistore1/temp_import/extracted/AFFILIATE MARKETING I',
  categoryPath: ['eBooks', 'Business', 'Marketing', 'Affiliate Marketing'],
};

importEbooks(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

