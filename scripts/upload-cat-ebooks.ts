import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import FormData from 'form-data';
import AWS from 'aws-sdk';

const SOURCE_DIR = '/Users/raidf/Downloads/ALL ABOUT CATS';
const API_URL = 'https://digistore1-backend.onrender.com';
const ADMIN_SECRET = 'cleanup-digistore1-2024';

// AWS S3 config
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-west-1',
});
const S3_BUCKET = 'digistore1-downloads';

// Cloudinary config
const CLOUDINARY_CLOUD = 'donkzbuyp';
const CLOUDINARY_KEY = '281985365816781';
const CLOUDINARY_SECRET = 'mmdvkGNnW6QxzgwYGznYsvYtLws';

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
    const tempPng = path.join(tempDir, `${baseName}.png`);
    
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
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));
    formData.append('upload_preset', 'ml_default');
    formData.append('folder', 'digistore/cat-ebooks');

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      formData,
      { headers: formData.getHeaders() }
    );
    return response.data.secure_url;
  } catch (error) {
    return null;
  }
}

async function uploadToS3(filePath: string, key: string): Promise<string> {
  const fileContent = fs.readFileSync(filePath);
  await s3.putObject({
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileContent,
    ContentType: 'application/pdf',
  }).promise();
  return `https://${S3_BUCKET}.s3.us-west-1.amazonaws.com/${key}`;
}

async function createProduct(data: any): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${API_URL}/api/admin/products/bulk-import`, data, {
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
    });
    return { success: true };
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    return { success: false, error: msg };
  }
}

async function main() {
  // Find all PDFs recursively, excluding License.pdf
  const pdfs = execSync(`find "${SOURCE_DIR}" -name "*.pdf" -type f`)
    .toString().trim().split('\n')
    .filter(p => !p.includes('License.pdf'));
  
  console.log(`Found ${pdfs.length} cat eBook PDFs\n`);

  let success = 0, errors = 0;
  const tempCoverDir = '/tmp/cat-covers';
  if (!fs.existsSync(tempCoverDir)) fs.mkdirSync(tempCoverDir, { recursive: true });

  for (let i = 0; i < pdfs.length; i++) {
    const pdfPath = pdfs[i];
    const filename = path.basename(pdfPath);
    const title = cleanTitle(filename);
    const slug = slugify(title) + '-cat';
    
    console.log(`[${i + 1}/${pdfs.length}] ${title}`);

    // 1. Upload PDF to S3
    const s3Key = `ebooks/cats/${slug}.pdf`;
    const fileUrl = await uploadToS3(pdfPath, s3Key);
    console.log(`  ✓ S3: ${s3Key}`);

    // 2. Extract cover and upload to Cloudinary
    const coverPath = path.join(tempCoverDir, `${slug}.jpg`);
    let thumbnailUrl = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400';
    if (await extractCover(pdfPath, coverPath) && fs.existsSync(coverPath)) {
      const cloudUrl = await uploadToCloudinary(coverPath);
      if (cloudUrl) { thumbnailUrl = cloudUrl; console.log(`  ✓ Cover uploaded`); }
      fs.unlinkSync(coverPath);
    }

    // 3. Create product (FREE - $0)
    const created = await createProduct({
      title, slug, price: 0, categoryName: 'Pets & Animals',
      shortDescription: `Free eBook about cats: ${title}`,
      description: `Download this free cat eBook: ${title}. Learn everything about cat care, training, and more.`,
      fileUrl, thumbnailUrl, tags: ['cats', 'pets', 'free'],
      fileType: 'PDF',
      fileName: `${slug}.pdf`,
    });
    
    if (created.success) { success++; console.log(`  ✓ Product created (FREE)`); }
    else { errors++; console.log(`  ✗ Failed: ${created.error}`); }
  }

  console.log(`\n✅ Complete! Success: ${success}, Errors: ${errors}`);
}

main();

