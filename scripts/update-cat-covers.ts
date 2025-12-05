import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import FormData from 'form-data';

const SOURCE_DIR = '/Users/raidf/Downloads/ALL ABOUT CATS';
const API_URL = 'https://digistore1-backend.onrender.com';
const ADMIN_SECRET = 'cleanup-digistore1-2024';
const CLOUDINARY_CLOUD = 'donkzbuyp';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cleanTitle(filename: string): string {
  return filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function extractCover(pdfPath: string, outputPath: string): Promise<boolean> {
  try {
    const tempDir = '/tmp/cat-covers';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const baseName = path.basename(pdfPath, '.pdf');
    
    execSync(`qlmanage -t -s 800 -o "${tempDir}" "${pdfPath}" 2>/dev/null`, { stdio: 'pipe' });
    
    const files = fs.readdirSync(tempDir).filter(f => f.includes(baseName) && f.endsWith('.png'));
    if (files.length > 0) {
      const pngFile = path.join(tempDir, files[0]);
      execSync(`sips -s format jpeg "${pngFile}" --out "${outputPath}" 2>/dev/null`, { stdio: 'pipe' });
      fs.unlinkSync(pngFile);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function uploadToCloudinary(imagePath: string): Promise<string | null> {
  try {
    // Use backend's upload endpoint
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(
      `${API_URL}/api/admin/upload/image`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'x-admin-secret': ADMIN_SECRET
        }
      }
    );
    return response.data.data?.url || response.data.url;
  } catch (error: any) {
    console.log(`    Upload error: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function updateProductThumbnail(slug: string, thumbnailUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.put(`${API_URL}/api/admin/products/update-thumbnail`,
      { slug, thumbnailUrl },
      { headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET } }
    );
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

async function main() {
  // Find all PDFs recursively, excluding License.pdf
  const pdfs = execSync(`find "${SOURCE_DIR}" -name "*.pdf" -type f`)
    .toString().trim().split('\n')
    .filter(p => !p.includes('License.pdf'));
  
  console.log(`Found ${pdfs.length} cat eBook PDFs to extract covers\n`);

  let success = 0, errors = 0;
  const tempCoverDir = '/tmp/cat-covers';
  if (!fs.existsSync(tempCoverDir)) fs.mkdirSync(tempCoverDir, { recursive: true });

  for (let i = 0; i < pdfs.length; i++) {
    const pdfPath = pdfs[i];
    const filename = path.basename(pdfPath);
    const title = cleanTitle(filename);
    const slug = slugify(title); // No -cat suffix, matches what the API generates
    
    console.log(`[${i + 1}/${pdfs.length}] ${title}`);

    // 1. Extract cover
    const coverPath = path.join(tempCoverDir, `${slug}.jpg`);
    if (!await extractCover(pdfPath, coverPath) || !fs.existsSync(coverPath)) {
      console.log(`  ✗ Failed to extract cover`);
      errors++;
      continue;
    }
    console.log(`  ✓ Cover extracted`);

    // 2. Upload to Cloudinary
    const cloudUrl = await uploadToCloudinary(coverPath);
    if (!cloudUrl) {
      console.log(`  ✗ Failed to upload to Cloudinary`);
      errors++;
      fs.unlinkSync(coverPath);
      continue;
    }
    console.log(`  ✓ Uploaded to Cloudinary`);
    fs.unlinkSync(coverPath);

    // 3. Update product thumbnail
    const result = await updateProductThumbnail(slug, cloudUrl);
    if (result.success) {
      console.log(`  ✓ Product updated`);
      success++;
    } else {
      console.log(`  ✗ Failed to update product: ${result.error}`);
      errors++;
    }
  }

  console.log(`\n✅ Complete! Success: ${success}, Errors: ${errors}`);
}

main();

