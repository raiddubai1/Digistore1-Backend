import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary (same as backend)
cloudinary.config({
  cloud_name: 'donkzbuyp',
  api_key: '281985365816781',
  api_secret: 'mmdvkGNnW6QxzgwYGznYsvYtLws',
});

const FOLDER_PATH = '/Users/raidf/Downloads/ALL ABOUT DOGS';
const API_URL = 'https://digistore1-backend.onrender.com';
const ADMIN_SECRET = 'cleanup-digistore1-2024';

// Helper to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Helper to generate title from filename
function generateTitle(filename: string): string {
  return filename
    .replace('.pdf', '')
    .replace('.PDF', '')
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

// Extract first page of PDF using pdf.js and canvas
async function extractPdfCover(pdfPath: string, outputPath: string): Promise<boolean> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('canvas');
    
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    await page.render({
      canvasContext: context as any,
      viewport: viewport,
    }).promise;
    
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    console.error(`   Error extracting cover: ${error}`);
    return false;
  }
}

// Upload image to Cloudinary
async function uploadToCloudinary(imagePath: string, publicId: string): Promise<string | null> {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: 'digistore1/dog-ebooks',
      public_id: publicId,
      overwrite: true,
      transformation: [
        { width: 400, height: 600, crop: 'fill', gravity: 'north' }
      ]
    });
    return result.secure_url;
  } catch (error) {
    console.error(`   Error uploading to Cloudinary: ${error}`);
    return null;
  }
}

// Update product thumbnail via API
async function updateProductThumbnail(slug: string, thumbnailUrl: string): Promise<boolean> {
  try {
    const response = await axios.put(
      `${API_URL}/api/admin/products/update-thumbnail`,
      { slug, thumbnailUrl },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET,
        },
        timeout: 30000,
      }
    );
    return response.data.success;
  } catch (error: any) {
    console.error(`   Error updating product: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function main() {
  console.log('Starting PDF cover extraction and upload...\n');
  
  // Create temp directory for covers
  const tempDir = path.join(__dirname, 'temp-covers');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Get all PDF files
  const files = fs.readdirSync(FOLDER_PATH).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`Found ${files.length} PDF files\n`);
  
  let success = 0;
  let errors = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const title = generateTitle(file);
    const slug = generateSlug(title);
    
    console.log(`[${i + 1}/${files.length}] Processing: ${title}`);
    
    const pdfPath = path.join(FOLDER_PATH, file);
    const coverPath = path.join(tempDir, `${slug}.jpg`);
    
    // Step 1: Extract cover
    console.log('   Extracting cover...');
    const extracted = await extractPdfCover(pdfPath, coverPath);
    if (!extracted) {
      console.log('   ✗ Failed to extract cover');
      errors++;
      continue;
    }
    
    // Step 2: Upload to Cloudinary
    console.log('   Uploading to Cloudinary...');
    const cloudinaryUrl = await uploadToCloudinary(coverPath, slug);
    if (!cloudinaryUrl) {
      console.log('   ✗ Failed to upload to Cloudinary');
      errors++;
      continue;
    }
    
    // Step 3: Update product
    console.log('   Updating product...');
    const updated = await updateProductThumbnail(slug, cloudinaryUrl);
    if (!updated) {
      console.log('   ✗ Failed to update product');
      errors++;
      continue;
    }
    
    console.log(`   ✓ Done: ${cloudinaryUrl.substring(0, 60)}...`);
    success++;
    
    // Clean up temp file
    fs.unlinkSync(coverPath);
  }
  
  // Clean up temp directory
  fs.rmdirSync(tempDir);
  
  console.log('\n========================================');
  console.log(`Cover extraction complete!`);
  console.log(`  ✓ Success: ${success}`);
  console.log(`  ✗ Errors: ${errors}`);
  console.log('========================================\n');
}

main().catch(console.error);

