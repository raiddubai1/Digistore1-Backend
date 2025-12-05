import * as fs from 'fs';
import * as path from 'path';
import AWS from 'aws-sdk';
import axios from 'axios';

// S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-west-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'digistore1-downloads';
const FOLDER_PATH = '/Users/raidf/Downloads/ALL ABOUT DOGS';
const CATEGORY_NAME = 'Pets & Animals'; // Will be created if doesn't exist
const API_URL = 'https://digistore1-backend.onrender.com';
const ADMIN_SECRET = 'cleanup-digistore1-2024';

// Dog placeholder image from Unsplash
const DOG_THUMBNAIL = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop';
const DOG_PREVIEW = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=800&fit=crop';

// Generate description based on filename
function generateDescription(filename: string): { title: string; shortDesc: string; longDesc: string; tags: string[] } {
  const name = filename.replace(/\.(pdf|doc|docx|txt)$/i, '').replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  const titleCase = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  
  const topics: Record<string, { desc: string; tags: string[] }> = {
    'training': { desc: 'comprehensive dog training techniques and methods', tags: ['dog training', 'obedience', 'behavior'] },
    'puppy': { desc: 'essential puppy care and training guidance', tags: ['puppy', 'puppy training', 'new dog owner'] },
    'health': { desc: 'dog health tips and wellness information', tags: ['dog health', 'pet wellness', 'veterinary'] },
    'care': { desc: 'complete dog care and maintenance guide', tags: ['dog care', 'pet care', 'grooming'] },
    'potty': { desc: 'effective potty training and housebreaking methods', tags: ['potty training', 'housebreaking', 'training'] },
    'food': { desc: 'nutrition and feeding guidelines for dogs', tags: ['dog food', 'nutrition', 'feeding'] },
    'treat': { desc: 'healthy dog treats and reward-based training', tags: ['dog treats', 'rewards', 'training'] },
    'barking': { desc: 'solutions for excessive barking and noise control', tags: ['barking', 'behavior', 'training'] },
    'bite': { desc: 'bite prevention and safety information', tags: ['safety', 'bite prevention', 'behavior'] },
    'breed': { desc: 'breed-specific information and characteristics', tags: ['dog breeds', 'breed guide', 'characteristics'] },
    'pit': { desc: 'pit bull specific care and training information', tags: ['pit bull', 'breed specific', 'training'] },
    'crate': { desc: 'crate training methods and best practices', tags: ['crate training', 'training', 'behavior'] },
    'leash': { desc: 'leash training and walking techniques', tags: ['leash training', 'walking', 'obedience'] },
    'obedience': { desc: 'obedience training and command teaching', tags: ['obedience', 'commands', 'training'] },
    'adopt': { desc: 'adoption guidance and new dog owner tips', tags: ['adoption', 'rescue', 'new dog owner'] },
    'house': { desc: 'dog house building and shelter information', tags: ['dog house', 'shelter', 'DIY'] },
    'owner': { desc: 'essential knowledge for dog owners', tags: ['dog owner', 'pet parent', 'care guide'] },
    'names': { desc: 'creative and popular dog naming ideas', tags: ['dog names', 'puppy names', 'naming'] },
    'chow': { desc: 'Chow Chow breed specific information', tags: ['chow chow', 'breed specific', 'care'] },
  };
  
  let matchedTopic = { desc: 'essential dog care and ownership information', tags: ['dogs', 'pets', 'care'] };
  const lowerName = name.toLowerCase();
  
  for (const [key, value] of Object.entries(topics)) {
    if (lowerName.includes(key)) {
      matchedTopic = value;
      break;
    }
  }
  
  const shortDesc = `Discover ${matchedTopic.desc} in this comprehensive eBook guide.`;
  const longDesc = `${titleCase} is your complete guide to ${matchedTopic.desc}. This professionally written eBook provides practical advice, expert tips, and proven strategies that every dog owner needs. Whether you're a first-time dog owner or an experienced pet parent, this guide offers valuable insights to help you build a stronger bond with your furry companion.\n\nKey topics covered include step-by-step instructions, common mistakes to avoid, and expert recommendations based on years of experience. Download this eBook today and take the first step towards becoming a better dog owner.`;
  
  return {
    title: titleCase,
    shortDesc,
    longDesc,
    tags: [...matchedTopic.tags, 'ebook', 'digital download', 'dogs'],
  };
}

// Upload file to S3
async function uploadToS3(filePath: string, fileName: string): Promise<{ url: string; size: number }> {
  const fileContent = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;
  const key = `downloads/dogs/${Date.now()}-${fileName.replace(/\s+/g, '-')}`;
  
  await s3.upload({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: 'application/pdf',
  }).promise();
  
  const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-1'}.amazonaws.com/${key}`;
  return { url, size: fileSize };
}

async function createProductViaAPI(productData: any): Promise<boolean> {
  try {
    const response = await axios.post(`${API_URL}/api/admin/products/bulk-import`, productData, {
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
      },
      timeout: 30000,
    });
    return response.data.success;
  } catch (error: any) {
    if (error.response?.data?.message?.includes('already exists')) {
      return false; // Skip, not an error
    }
    throw error;
  }
}

async function main() {
  console.log('Starting dog eBooks upload...\n');

  // Get all PDF files
  const files = fs.readdirSync(FOLDER_PATH).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`Found ${files.length} PDF files to upload\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(FOLDER_PATH, file);
    const { title, shortDesc, longDesc, tags } = generateDescription(file);

    try {
      // Upload to S3
      console.log(`[${i + 1}/${files.length}] Uploading: ${file}...`);
      const { url, size } = await uploadToS3(filePath, file);

      // Generate random price between $4.99 and $14.99
      const price = Math.round((4.99 + Math.random() * 10) * 100) / 100;
      const originalPrice = Math.round(price * (1.3 + Math.random() * 0.4) * 100) / 100;

      // Create product via API
      const productData = {
        title,
        description: longDesc,
        shortDescription: shortDesc,
        price,
        originalPrice,
        categoryName: CATEGORY_NAME,
        subcategory: 'Dogs',
        tags,
        fileType: 'pdf',
        fileSize: size,
        fileUrl: url,
        fileName: file,
        thumbnailUrl: DOG_THUMBNAIL,
        previewImages: [DOG_PREVIEW],
        whatsIncluded: ['Complete eBook in PDF format', 'Instant digital download', 'Lifetime access'],
        requirements: ['PDF reader (Adobe Acrobat, Preview, etc.)'],
      };

      const created = await createProductViaAPI(productData);
      if (created) {
        console.log(`   ✓ Created: "${title}" - $${price}`);
        successCount++;
      } else {
        console.log(`   → Skipped: "${title}" (already exists)`);
        skipCount++;
      }
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.response?.data?.message || error.message}`);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log(`Upload complete!`);
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  → Skipped: ${skipCount}`);
  console.log(`  ✗ Errors: ${errorCount}`);
  console.log('========================================\n');
}

main().catch(console.error);

