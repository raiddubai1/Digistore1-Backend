/**
 * Category Restructuring Script for Digistore1
 * 
 * Operations:
 * 1. DELETE eBooks category and all subcategories with products
 * 2. DELETE Courses & Learning category and all subcategories with products
 * 3. MERGE Canva Templates subcategories into "Business & Marketing Templates"
 * 4. MERGE Planners & Printables subcategories into "Productivity & Lifestyle"
 * 5. CREATE hidden "Free Resources Library" category
 */

import axios from 'axios';

const API_URL = 'https://digistore1-backend.onrender.com';
const ADMIN_SECRET = 'cleanup-digistore1-2024';

const headers = {
  'Content-Type': 'application/json',
  'x-admin-secret': ADMIN_SECRET,
};

// Category IDs from production database
const CATEGORY_IDS = {
  // Categories to DELETE (with all products)
  eBooks: 'cmitanjuz0000h43howmybvro',
  eBooksChildren: [
    'cmitbeyeq0003iy3hxy92jsjq', // Pets & Animals (86 products)
    'cmitbeyob0005iy3hv4ux9vgh', // Business & Marketing (4 products)
    'cmitdk0gg003biy3h692hhf8o', // Blogging & Content Creation (42 products)
    'cmitbez93000diy3h2pjqai9g', // Technology & AI (0 products)
    'cmitbeysm0007iy3hqnjaoek2', // Self-Help & Lifestyle (0 products)
    'cmitbezdj000fiy3hhnrn7grc', // Other Topics (0 products)
    'cmitbez5k000biy3hbbtd7cy5', // Finance & Investing (0 products)
    'cmitbeyx00009iy3hd3ok6viy', // Health & Fitness (0 products)
  ],
  
  coursesAndLearning: 'cmitanl80000fh43hs2gwoylj',
  coursesChildren: [
    'cmitbf3vm002fiy3habw2h2df', // YouTube / Social Media Courses (1 product)
    'cmitbf41n002hiy3h2oyzt7w1', // Other Learning (0 products)
    'cmitbf3qz002diy3hx3lhyi62', // Business & Marketing Courses (0 products)
  ],
  
  // Canva Templates - Parent and children to merge
  canvaTemplates: 'cmitanknl0006h43h511ct82l',
  canvaToMerge: [
    'cmitbf16z0017iy3hlce3tnng', // Business Templates (14 products)
    'cmitbf1lu001biy3h2omf0mea', // Marketing Templates (0 products)
    'cmitbf2ct001piy3h6z0xu74z', // Social Media Packs (0 products)
  ],
  
  // Planners & Printables - Parent and children to merge
  plannersAndPrintables: 'cmitanldb000ih43hbi9a9lx9',
  plannersToMerge: [
    'cmitbf4uu002riy3hr8vaczqg', // ADHD & Productivity (1 product)
    'cmitbf4m3002niy3hib1fm7t8', // Daily & Weekly Planners (0 products)
    'cmitbf47v002jiy3hm7h6b646', // Lifestyle Planners (0 products)
  ],
};

let totalProductsDeleted = 0;
let totalProductsMoved = 0;
let totalCategoriesDeleted = 0;

async function deleteProductsInCategory(categoryId: string, categoryName: string): Promise<number> {
  console.log(`\n  Deleting products in: ${categoryName} (${categoryId})`);
  
  try {
    // First get all products in this category
    const response = await axios.get(`${API_URL}/api/products?category=${categoryId}&limit=1000`);
    const products = response.data?.data?.products || [];
    
    if (products.length === 0) {
      console.log(`    No products found`);
      return 0;
    }
    
    console.log(`    Found ${products.length} products to delete`);
    
    // Delete each product
    for (const product of products) {
      try {
        await axios.delete(`${API_URL}/api/admin/products/${product.slug}`, { headers });
        console.log(`    ✓ Deleted: ${product.title}`);
      } catch (err: any) {
        console.error(`    ✗ Failed to delete ${product.title}: ${err.response?.data?.message || err.message}`);
      }
    }
    
    return products.length;
  } catch (error: any) {
    console.error(`    Error getting products: ${error.response?.data?.message || error.message}`);
    return 0;
  }
}

async function deleteCategory(categoryId: string, categoryName: string): Promise<boolean> {
  console.log(`  Deleting category: ${categoryName}`);
  try {
    await axios.delete(`${API_URL}/api/admin/categories/${categoryId}`, { headers });
    console.log(`    ✓ Category deleted`);
    return true;
  } catch (error: any) {
    console.error(`    ✗ Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function createCategory(name: string, parentId?: string, active: boolean = true): Promise<string | null> {
  console.log(`  Creating category: ${name}${parentId ? ' (as subcategory)' : ''}`);
  try {
    const response = await axios.post(`${API_URL}/api/admin/categories`, {
      name,
      parentId,
      active,
    }, { headers });
    const newId = response.data?.data?.category?.id;
    console.log(`    ✓ Created with ID: ${newId}`);
    return newId;
  } catch (error: any) {
    console.error(`    ✗ Failed: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function moveProducts(fromCategoryId: string, toCategoryId: string, categoryName: string): Promise<number> {
  console.log(`  Moving products from ${categoryName} to new category`);
  
  try {
    // Get products by category slug - need to get the slug first
    const catResponse = await axios.get(`${API_URL}/api/categories`);
    const categories = catResponse.data?.data?.categories || [];
    
    // Find the category with matching ID to get its slug
    const findCat = (cats: any[], id: string): any => {
      for (const cat of cats) {
        if (cat.id === id) return cat;
        if (cat.children) {
          const found = findCat(cat.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    const category = findCat(categories, fromCategoryId);
    if (!category) {
      console.log(`    Could not find category with ID ${fromCategoryId}`);
      return 0;
    }
    
    // Get products
    const prodResponse = await axios.get(`${API_URL}/api/products?limit=1000`);
    const allProducts = prodResponse.data?.data?.products || [];
    const products = allProducts.filter((p: any) => p.category?.id === fromCategoryId);
    
    if (products.length === 0) {
      console.log(`    No products to move`);
      return 0;
    }
    
    console.log(`    Found ${products.length} products to move`);
    return products.length;
  } catch (error: any) {
    console.error(`    Error: ${error.response?.data?.message || error.message}`);
    return 0;
  }
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('DIGISTORE1 CATEGORY RESTRUCTURING');
  console.log('='.repeat(60));

  // STEP 1: Delete eBooks category and all products
  console.log('\n[STEP 1] Deleting eBooks category and all products...');

  // Delete products in all eBooks subcategories first
  for (const catId of CATEGORY_IDS.eBooksChildren) {
    const count = await deleteProductsInCategory(catId, `eBooks subcategory`);
    totalProductsDeleted += count;
  }

  // Delete subcategories (children first)
  for (const catId of CATEGORY_IDS.eBooksChildren) {
    if (await deleteCategory(catId, `eBooks subcategory`)) {
      totalCategoriesDeleted++;
    }
  }

  // Delete parent category
  if (await deleteCategory(CATEGORY_IDS.eBooks, 'eBooks')) {
    totalCategoriesDeleted++;
  }

  // STEP 2: Delete Courses & Learning category and all products
  console.log('\n[STEP 2] Deleting Courses & Learning category and all products...');

  for (const catId of CATEGORY_IDS.coursesChildren) {
    const count = await deleteProductsInCategory(catId, `Courses subcategory`);
    totalProductsDeleted += count;
  }

  for (const catId of CATEGORY_IDS.coursesChildren) {
    if (await deleteCategory(catId, `Courses subcategory`)) {
      totalCategoriesDeleted++;
    }
  }

  if (await deleteCategory(CATEGORY_IDS.coursesAndLearning, 'Courses & Learning')) {
    totalCategoriesDeleted++;
  }

  // STEP 3: Merge Canva Templates subcategories
  console.log('\n[STEP 3] Merging Canva Templates subcategories into "Business & Marketing Templates"...');

  // Create the new merged category
  const newCanvaSubId = await createCategory('Business & Marketing Templates', CATEGORY_IDS.canvaTemplates);

  if (newCanvaSubId) {
    // Move products from the old categories to the new one
    for (const catId of CATEGORY_IDS.canvaToMerge) {
      // Get products and update their categoryId
      try {
        const prodResponse = await axios.get(`${API_URL}/api/products?limit=1000`);
        const allProducts = prodResponse.data?.data?.products || [];
        const products = allProducts.filter((p: any) => p.category?.id === catId);

        for (const product of products) {
          try {
            await axios.put(`${API_URL}/api/products/${product.id}`, {
              categoryId: newCanvaSubId
            }, {
              headers: { ...headers, 'Authorization': `Bearer admin` }
            });
            console.log(`    ✓ Moved: ${product.title}`);
            totalProductsMoved++;
          } catch (err: any) {
            console.error(`    ✗ Failed to move ${product.title}`);
          }
        }
      } catch (err) {
        console.error(`    Error getting products`);
      }
    }

    // Delete old categories
    for (const catId of CATEGORY_IDS.canvaToMerge) {
      await deleteCategory(catId, 'Old Canva subcategory');
      totalCategoriesDeleted++;
    }
  }

  // STEP 4: Merge Planners & Printables subcategories
  console.log('\n[STEP 4] Merging Planners & Printables subcategories into "Productivity & Lifestyle"...');

  const newPlannersSubId = await createCategory('Productivity & Lifestyle', CATEGORY_IDS.plannersAndPrintables);

  if (newPlannersSubId) {
    for (const catId of CATEGORY_IDS.plannersToMerge) {
      try {
        const prodResponse = await axios.get(`${API_URL}/api/products?limit=1000`);
        const allProducts = prodResponse.data?.data?.products || [];
        const products = allProducts.filter((p: any) => p.category?.id === catId);

        for (const product of products) {
          try {
            await axios.put(`${API_URL}/api/products/${product.id}`, {
              categoryId: newPlannersSubId
            }, {
              headers: { ...headers, 'Authorization': `Bearer admin` }
            });
            console.log(`    ✓ Moved: ${product.title}`);
            totalProductsMoved++;
          } catch (err: any) {
            console.error(`    ✗ Failed to move ${product.title}`);
          }
        }
      } catch (err) {
        console.error(`    Error getting products`);
      }
    }

    for (const catId of CATEGORY_IDS.plannersToMerge) {
      await deleteCategory(catId, 'Old Planners subcategory');
      totalCategoriesDeleted++;
    }
  }

  // STEP 5: Create hidden "Free Resources Library" category
  console.log('\n[STEP 5] Creating hidden "Free Resources Library" category...');
  await createCategory('Free Resources Library', undefined, false);

  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('RESTRUCTURING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total products deleted: ${totalProductsDeleted}`);
  console.log(`Total products moved: ${totalProductsMoved}`);
  console.log(`Total categories deleted: ${totalCategoriesDeleted}`);
  console.log(`New categories created: 3 (Business & Marketing Templates, Productivity & Lifestyle, Free Resources Library)`);
}

main().catch(console.error);

