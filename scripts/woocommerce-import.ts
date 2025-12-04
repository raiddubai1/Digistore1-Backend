/**
 * WooCommerce Product Import Script
 * 
 * This script fetches products from a WooCommerce store via REST API
 * and imports them into Digistore1's database.
 * 
 * Usage:
 *   npx ts-node scripts/woocommerce-import.ts
 * 
 * Environment variables required:
 *   WOOCOMMERCE_URL - The WooCommerce store URL (e.g., https://yourstore.com)
 *   WOOCOMMERCE_KEY - Consumer Key from WooCommerce REST API
 *   WOOCOMMERCE_SECRET - Consumer Secret from WooCommerce REST API
 */

import axios from 'axios';
import { PrismaClient, ProductStatus } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// WooCommerce API configuration
const WOOCOMMERCE_URL = process.env.WOOCOMMERCE_URL || 'https://digistore1.com';
const WOOCOMMERCE_KEY = process.env.WOOCOMMERCE_KEY || 'ck_15e3f0107fda4ef024edce9e688d7d9c84f70547';
const WOOCOMMERCE_SECRET = process.env.WOOCOMMERCE_SECRET || 'cs_041219985a4000782bdcca1e259e11cb6c53e3c9';

// Track WooCommerce ID -> Digistore1 ID mappings
const categoryMap = new Map<number, string>();
const attributeMap = new Map<number, string>();

interface WooProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  sale_price: string;
  categories: Array<{ id: number; name: string; slug: string }>;
  tags: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; alt: string }>;
  downloadable: boolean;
  downloads: Array<{ id: string; name: string; file: string }>;
  featured: boolean;
  average_rating: string;
  rating_count: number;
  total_sales: number;
  date_created: string;
}

async function fetchWooProducts(page = 1, perPage = 100): Promise<WooProduct[]> {
  if (!WOOCOMMERCE_URL) {
    throw new Error('WOOCOMMERCE_URL environment variable is required');
  }

  const url = `${WOOCOMMERCE_URL}/wp-json/wc/v3/products`;
  
  try {
    const response = await axios.get(url, {
      auth: {
        username: WOOCOMMERCE_KEY,
        password: WOOCOMMERCE_SECRET,
      },
      params: {
        page,
        per_page: perPage,
        status: 'publish',
      },
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Error fetching WooCommerce products:', error.message);
    throw error;
  }
}

interface WooCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description: string;
  image: { src: string } | null;
  menu_order: number;
}

async function fetchAllCategories(): Promise<WooCategory[]> {
  const url = `${WOOCOMMERCE_URL}/wp-json/wc/v3/products/categories`;
  const allCategories: WooCategory[] = [];
  let page = 1;

  while (true) {
    const response = await axios.get(url, {
      auth: { username: WOOCOMMERCE_KEY, password: WOOCOMMERCE_SECRET },
      params: { page, per_page: 100 },
    });

    allCategories.push(...response.data);
    const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
    if (page >= totalPages) break;
    page++;
  }
  return allCategories;
}

async function migrateAllCategories(): Promise<void> {
  console.log('\n📁 Migrating Categories...');
  const wooCategories = await fetchAllCategories();
  console.log(`  Found ${wooCategories.length} categories`);

  // Sort: parent=0 first (top-level), then by parent ID
  wooCategories.sort((a, b) => a.parent - b.parent);

  for (const wc of wooCategories) {
    const parentId = wc.parent > 0 ? categoryMap.get(wc.parent) : null;
    const uniqueSlug = wc.slug + '-' + Date.now().toString(36).slice(-4);

    try {
      const cat = await prisma.category.create({
        data: {
          name: wc.name,
          slug: uniqueSlug,
          description: stripHtml(wc.description) || null,
          image: wc.image?.src || null,
          parentId,
          active: true,
          order: wc.menu_order || 0,
        },
      });
      categoryMap.set(wc.id, cat.id);
      console.log(`  ✓ ${wc.parent > 0 ? '  └─' : ''} ${wc.name}`);
    } catch (err: any) {
      console.error(`  ✗ Failed: ${wc.name} - ${err.message}`);
    }
  }
  console.log(`  Total: ${categoryMap.size} categories migrated`);
}

async function migrateAttributes(): Promise<void> {
  console.log('\n🏷️  Migrating Attributes...');
  const url = `${WOOCOMMERCE_URL}/wp-json/wc/v3/products/attributes`;

  const response = await axios.get(url, {
    auth: { username: WOOCOMMERCE_KEY, password: WOOCOMMERCE_SECRET },
    params: { per_page: 100 },
  });

  const wooAttrs = response.data;
  console.log(`  Found ${wooAttrs.length} attributes`);

  for (const wa of wooAttrs) {
    try {
      // Fetch terms for this attribute
      const termsUrl = `${WOOCOMMERCE_URL}/wp-json/wc/v3/products/attributes/${wa.id}/terms`;
      const termsRes = await axios.get(termsUrl, {
        auth: { username: WOOCOMMERCE_KEY, password: WOOCOMMERCE_SECRET },
        params: { per_page: 100 },
      });
      const options = termsRes.data.map((t: any) => t.name);

      const attr = await prisma.attribute.create({
        data: {
          name: wa.name,
          slug: wa.slug + '-' + Date.now().toString(36).slice(-4),
          type: options.length > 0 ? 'SELECT' : 'TEXT',
          options,
          active: true,
        },
      });
      attributeMap.set(wa.id, attr.id);
      console.log(`  ✓ ${wa.name} (${options.length} options)`);
    } catch (err: any) {
      console.error(`  ✗ Failed: ${wa.name} - ${err.message}`);
    }
  }
  console.log(`  Total: ${attributeMap.size} attributes migrated`);
}

async function getOrCreateVendor(): Promise<string> {
  // Find or create admin user with vendor profile
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  if (!admin) {
    const bcrypt = await import('bcryptjs');
    admin = await prisma.user.create({
      data: {
        email: 'admin@digistore1.com',
        password: await bcrypt.hash('Admin123!', 10),
        name: 'Digistore1 Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
    console.log('  Created admin user: admin@digistore1.com');
  }

  let vendor = await prisma.vendorProfile.findUnique({ where: { userId: admin.id } });

  if (!vendor) {
    vendor = await prisma.vendorProfile.create({
      data: {
        userId: admin.id,
        businessName: 'Digistore1 Official',
        slug: 'digistore1-official-' + Date.now().toString(36).slice(-4),
        description: 'Official Digistore1 Products',
        status: 'ACTIVE',
      },
    });
    console.log('  Created vendor profile');
  }

  return vendor.id;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function importProducts(vendorId: string) {
  console.log('\n📦 Migrating Products...');

  let page = 1;
  let totalImported = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  // Get a fallback category if needed
  let fallbackCategoryId = categoryMap.values().next().value;
  if (!fallbackCategoryId) {
    const cat = await prisma.category.create({
      data: { name: 'Uncategorized', slug: 'uncategorized-' + Date.now().toString(36).slice(-4), active: true },
    });
    fallbackCategoryId = cat.id;
  }

  while (true) {
    console.log(`\n  Fetching page ${page}...`);
    const products = await fetchWooProducts(page);

    if (products.length === 0) break;

    console.log(`  Found ${products.length} products`);

    for (const wooProduct of products) {
      try {
        // Generate unique slug
        const baseSlug = wooProduct.slug || wooProduct.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const slug = baseSlug + '-' + Date.now().toString(36).slice(-4);

        // Get category from map (using first WooCommerce category)
        const wcCatId = wooProduct.categories[0]?.id;
        const categoryId = wcCatId && categoryMap.has(wcCatId)
          ? categoryMap.get(wcCatId)!
          : fallbackCategoryId;

        // Prepare product data
        const price = parseFloat(wooProduct.price) || 0;
        const regularPrice = parseFloat(wooProduct.regular_price) || price;
        const discount = regularPrice > price ? Math.round((1 - price / regularPrice) * 100) : 0;

        await prisma.product.create({
          data: {
            title: wooProduct.name,
            slug,
            description: stripHtml(wooProduct.description) || wooProduct.name,
            shortDescription: stripHtml(wooProduct.short_description) || '',
            price,
            originalPrice: regularPrice > price ? regularPrice : null,
            discount,
            categoryId,
            tags: wooProduct.tags.map(t => t.name),
            fileType: wooProduct.downloadable ? 'pdf' : 'digital',
            fileUrl: wooProduct.downloads[0]?.file || '',
            fileName: wooProduct.downloads[0]?.name || 'product-file',
            thumbnailUrl: wooProduct.images[0]?.src || '',
            previewImages: wooProduct.images.map(img => img.src),
            featured: wooProduct.featured,
            bestseller: wooProduct.total_sales > 10,
            newArrival: true,
            status: ProductStatus.ACTIVE,
            vendorId,
            rating: parseFloat(wooProduct.average_rating) || 0,
            reviewCount: wooProduct.rating_count || 0,
            downloadCount: wooProduct.total_sales || 0,
            publishedAt: new Date(wooProduct.date_created),
            metaTitle: wooProduct.name,
            metaDescription: stripHtml(wooProduct.short_description).slice(0, 160) || null,
          },
        });

        console.log(`  ✓ ${wooProduct.name}`);
        totalImported++;
      } catch (error: any) {
        console.error(`  ✗ Failed: ${wooProduct.name} - ${error.message}`);
        errors.push(`${wooProduct.name}: ${error.message}`);
        totalFailed++;
      }
    }

    page++;
  }

  console.log('\n========================================');
  console.log(`Import complete!`);
  console.log(`  Total imported: ${totalImported}`);
  console.log(`  Total failed: ${totalFailed}`);
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

// Main migration function
async function main() {
  console.log('🚀 WooCommerce to Digistore1 Migration');
  console.log('=' .repeat(50));

  try {
    // Verify empty database
    const productCount = await prisma.product.count();
    const categoryCount = await prisma.category.count();
    console.log(`\n📊 Current DB: ${productCount} products, ${categoryCount} categories`);

    if (productCount > 0 || categoryCount > 0) {
      console.log('\n⚠️  WARNING: Database not empty!');
      console.log('   Continuing will add new records alongside existing ones.');
      console.log('   To start fresh, run: npx prisma migrate reset');
    }

    // Get or create vendor
    console.log('\n👤 Setting up vendor...');
    const vendorId = await getOrCreateVendor();
    console.log(`   Vendor ID: ${vendorId}`);

    // Run migrations in order
    await migrateAllCategories();
    await migrateAttributes();
    await importProducts(vendorId);

    // Final summary
    const finalProducts = await prisma.product.count();
    const finalCategories = await prisma.category.count();
    const finalAttributes = await prisma.attribute.count();

    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration Complete!');
    console.log(`   Categories: ${finalCategories}`);
    console.log(`   Attributes: ${finalAttributes}`);
    console.log(`   Products: ${finalProducts}`);
    console.log('\n🎉 All products are editable in admin dashboard!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

