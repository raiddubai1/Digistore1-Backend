import axios from 'axios';

const API_URL = 'https://digistore1-backend.onrender.com';
const ADMIN_SECRET = 'cleanup-digistore1-2024';

const categoryStructure = {
  'eBooks': [
    'Pets & Animals', 'Business & Marketing', 'Self-Help & Lifestyle',
    'Health & Fitness', 'Finance & Investing', 'Technology & AI', 'Other Topics'
  ],
  'Lightroom Presets': [
    'All-in-One Preset Packs', 'Portrait Presets', 'Landscape & Nature',
    'Lifestyle & Aesthetic', 'Wedding & Romance', 'Indoor & Studio',
    'Food & Fashion', 'Travel & Urban', 'Children & Newborn', 'Sport & Action', 'Vintage & Film'
  ],
  'Canva Templates': [
    'Instagram Posts', 'Instagram Stories', 'Business Templates', 'Planners & Journals',
    'Marketing Templates', 'Testimonials', 'Lists & Checklists', 'Restaurant & Food',
    'Fitness & Gym', 'Real Estate', 'Education', 'Social Media Packs', 'Misc. Canva Templates'
  ],
  'Video Assets & Stock Footage': [
    'Animated Videos', 'Backgrounds', 'Business Videos', "Editor's Pick Videos", 'Mixed Stock Footage'
  ],
  'Design Assets': [
    'Icons', 'Mockups', 'Graphic Elements', 'Business Cards', 'Coloring Books', 'Games & Educational Printables'
  ],
  'Courses & Learning': [
    'Business & Marketing Courses', 'YouTube / Social Media Courses', 'Other Learning'
  ],
  'Planners & Printables': [
    'Lifestyle Planners', 'Home & Cleaning', 'Daily & Weekly Planners', 'Self-Care',
    'ADHD & Productivity', 'Children Printables', 'Coloring Pages'
  ],
  'Bundles & Mega Packs': [
    'Lightroom Mega Bundles', 'Canva Template Bundles', 'Video Bundles',
    'Design Bundles', 'eBook Bundles', 'All-in-One Packs'
  ]
};

async function createCategory(name: string, parentId?: string): Promise<string | null> {
  try {
    const resp = await axios.post(`${API_URL}/api/admin/categories`, {
      name,
      parentId: parentId || null,
    }, {
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET }
    });

    const category = resp.data?.data?.category;
    const existed = resp.data?.data?.existed;
    console.log(`  ${existed ? '○' : '✓'} ${existed ? 'Exists' : 'Created'}: ${name}`);
    return category?.id;
  } catch (err: any) {
    console.log(`  ✗ Failed: ${name} - ${err.response?.data?.message || err.message}`);
    return null;
  }
}

async function deleteProduct(slug: string): Promise<boolean> {
  try {
    await axios.delete(`${API_URL}/api/admin/products/${slug}`, {
      headers: { 'x-admin-secret': ADMIN_SECRET }
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Creating new category structure...\n');

  const parentIds: Record<string, string> = {};

  // Create parent categories first
  console.log('Step 1: Creating parent categories...');
  for (const parentName of Object.keys(categoryStructure)) {
    const id = await createCategory(parentName);
    if (id) parentIds[parentName] = id;
  }

  // Create subcategories
  console.log('\nStep 2: Creating subcategories...');
  for (const [parentName, subs] of Object.entries(categoryStructure)) {
    console.log(`\n  ${parentName}:`);
    const parentId = parentIds[parentName];
    if (!parentId) {
      console.log(`    ⚠ Skipping - parent not found`);
      continue;
    }
    for (const subName of subs) {
      await createCategory(subName, parentId);
    }
  }

  // Delete temp products created earlier
  console.log('\n\nStep 3: Cleaning up temp products...');
  const prodRes = await axios.get(`${API_URL}/api/products?limit=500`);
  const products = prodRes.data?.data?.products || [];
  const tempProducts = products.filter((p: any) => p.title.startsWith('TEMP_'));
  console.log(`Found ${tempProducts.length} temp products to delete`);

  let deleted = 0;
  for (const p of tempProducts) {
    if (await deleteProduct(p.slug)) deleted++;
  }
  console.log(`Deleted ${deleted} temp products`);

  console.log('\n✅ Category structure created!');
  console.log('\nVerifying...');

  const catRes = await axios.get(`${API_URL}/api/categories`);
  const cats = catRes.data?.data?.categories || [];
  console.log(`\nTotal parent categories: ${cats.length}`);
  for (const c of cats) {
    const childCount = c.children?.length || 0;
    console.log(`  ${c.name} (${childCount} subcategories)`);
  }
}

main();

