import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import FormData from 'form-data';

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

// Extract first page of PDF using macOS qlmanage (Quick Look)
async function extractPdfCover(pdfPath: string, outputDir: string, baseName: string): Promise<string | null> {
  try {
    // Use qlmanage to generate thumbnail
    // -t = generate thumbnail, -s = size, -o = output directory
    execSync(`qlmanage -t -s 800 -o "${outputDir}" "${pdfPath}" 2>/dev/null`, {
      timeout: 30000,
    });

    // qlmanage creates file with .png extension and adds suffix
    const pdfFileName = path.basename(pdfPath);
    const expectedOutput = path.join(outputDir, `${pdfFileName}.png`);

    if (fs.existsSync(expectedOutput)) {
      // Convert to JPEG using sips for better compression
      const jpegPath = path.join(outputDir, `${baseName}.jpg`);
      execSync(`sips -s format jpeg -s formatOptions 85 "${expectedOutput}" --out "${jpegPath}" 2>/dev/null`, {
        timeout: 30000,
      });

      // Remove the PNG
      fs.unlinkSync(expectedOutput);

      return jpegPath;
    }

    return null;
  } catch (error) {
    console.error(`   Error extracting cover: ${error}`);
    return null;
  }
}

// Upload image via admin API
async function uploadImage(imagePath: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(`${API_URL}/api/admin/upload/image`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (response.data.success) {
      return response.data.data.url;
    }
    return null;
  } catch (error: any) {
    console.error(`   Error uploading image: ${error.message || JSON.stringify(error)}`);
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

    // Step 1: Extract cover using qlmanage
    console.log('   Extracting cover...');
    const coverPath = await extractPdfCover(pdfPath, tempDir, slug);
    if (!coverPath) {
      console.log('   ✗ Failed to extract cover');
      errors++;
      continue;
    }

    // Step 2: Upload image via backend API
    console.log('   Uploading image...');
    const imageUrl = await uploadImage(coverPath);
    if (!imageUrl) {
      console.log('   ✗ Failed to upload image');
      errors++;
      // Clean up temp file
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
      continue;
    }

    // Step 3: Update product
    console.log('   Updating product...');
    const updated = await updateProductThumbnail(slug, imageUrl);
    if (!updated) {
      console.log('   ✗ Failed to update product');
      errors++;
      // Clean up temp file
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
      continue;
    }

    console.log(`   ✓ Done: ${imageUrl.substring(0, 60)}...`);
    success++;

    // Clean up temp file
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  }

  // Clean up temp directory
  try {
    fs.rmdirSync(tempDir, { recursive: true });
  } catch (e) {
    // Ignore cleanup errors
  }

  console.log('\n========================================');
  console.log(`Cover extraction complete!`);
  console.log(`  ✓ Success: ${success}`);
  console.log(`  ✗ Errors: ${errors}`);
  console.log('========================================\n');
}

main().catch(console.error);

