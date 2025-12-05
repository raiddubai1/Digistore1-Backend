import axios from 'axios';

const API_URL = 'https://digistore1-backend.onrender.com';
const ADMIN_SECRET = 'cleanup-digistore1-2024';

// Flatten categories including children
function flattenCategories(cats: any[]): any[] {
  let result: any[] = [];
  for (const c of cats) {
    result.push({ id: c.id, name: c.name, parentId: c.parentId });
    if (c.children && c.children.length > 0) {
      result = result.concat(flattenCategories(c.children));
    }
  }
  return result;
}

async function main() {
  try {
    // Step 1: Get all categories
    console.log('Step 1: Fetching all categories...');
    const catRes = await axios.get(`${API_URL}/api/categories`);
    const categories = catRes.data?.data?.categories || [];
    const flatCats = flattenCategories(categories);
    console.log(`Found ${flatCats.length} total categories (including nested)`);

    // Step 2: Find or create "Uncategorized" category
    console.log('\nStep 2: Finding/Creating Uncategorized category...');
    let uncategorizedId = flatCats.find((c: any) => c.name === 'Uncategorized')?.id;

    if (!uncategorizedId) {
      console.log('Creating Uncategorized category...');
      const resp = await axios.post(`${API_URL}/api/admin/products/bulk-import`, {
        title: 'TEMP_DELETE_ME_' + Date.now(),
        price: 0,
        categoryName: 'Uncategorized',
        shortDescription: 'temp',
        description: 'temp',
        fileUrl: 'https://temp.com/temp.pdf',
        thumbnailUrl: 'https://temp.com/temp.jpg',
        fileType: 'PDF',
        fileName: 'temp.pdf'
      }, {
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET }
      });

      // Fetch again to get the ID
      const catRes2 = await axios.get(`${API_URL}/api/categories`);
      const flatCats2 = flattenCategories(catRes2.data?.data?.categories || []);
      uncategorizedId = flatCats2.find((c: any) => c.name === 'Uncategorized')?.id;
    }

    console.log(`Uncategorized category ID: ${uncategorizedId}`);

    // Step 3: Get all products and move them to Uncategorized
    console.log('\nStep 3: Moving all products to Uncategorized...');
    const prodRes = await axios.get(`${API_URL}/api/products?limit=500`);
    const products = prodRes.data?.data?.products || [];
    console.log(`Found ${products.length} products`);

    let moved = 0, skipped = 0;
    for (const p of products) {
      if (p.category?.id !== uncategorizedId) {
        try {
          await axios.put(`${API_URL}/api/admin/products/update-thumbnail`, {
            slug: p.slug,
            categoryId: uncategorizedId
          }, {
            headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET }
          });
          moved++;
          if (moved % 20 === 0) console.log(`  Moved ${moved} products...`);
        } catch (err: any) {
          console.log(`  ✗ Failed to move: ${p.title} - ${err.response?.data?.message || err.message}`);
        }
      } else {
        skipped++;
      }
    }
    console.log(`✓ Moved ${moved} products, skipped ${skipped} (already in Uncategorized)`);

    // Step 4: Delete all categories except Uncategorized
    console.log('\nStep 4: Deleting all categories except Uncategorized...');

    // Refetch categories (some might have 0 products now)
    const catRes3 = await axios.get(`${API_URL}/api/categories`);
    const allCats = flattenCategories(catRes3.data?.data?.categories || []);
    const catsToDelete = allCats.filter((c: any) => c.id !== uncategorizedId);

    console.log(`Categories to delete: ${catsToDelete.length}`);

    // Delete deepest first (those with parentId), then parents
    const level3 = catsToDelete.filter((c: any) => {
      const parent = catsToDelete.find((p: any) => p.id === c.parentId);
      return parent && parent.parentId; // has grandparent
    });
    const level2 = catsToDelete.filter((c: any) => c.parentId && !level3.includes(c));
    const level1 = catsToDelete.filter((c: any) => !c.parentId);

    let deleted = 0, errors = 0;

    for (const level of [level3, level2, level1]) {
      for (const cat of level) {
        try {
          await axios.delete(`${API_URL}/api/admin/categories/${cat.id}`, {
            headers: { 'x-admin-secret': ADMIN_SECRET }
          });
          deleted++;
          console.log(`  ✓ Deleted: ${cat.name}`);
        } catch (err: any) {
          errors++;
          console.log(`  ✗ Failed: ${cat.name} - ${err.response?.data?.message || err.message}`);
        }
      }
    }

    console.log(`\n✅ Complete! Deleted ${deleted} categories, ${errors} errors`);
    console.log(`All products are now in "Uncategorized" category.`);

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();

