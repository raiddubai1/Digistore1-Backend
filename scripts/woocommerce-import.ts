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
const WOOCOMMERCE_URL = process.env.WOOCOMMERCE_URL || '';
const WOOCOMMERCE_KEY = process.env.WOOCOMMERCE_KEY || 'ck_991eb57491fec38ee0a2fe75aa0414cc51548e7e';
const WOOCOMMERCE_SECRET = process.env.WOOCOMMERCE_SECRET || 'cs_2d3b48499cabee29e5ae5794acfe4503707e3f93';

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

async function getOrCreateCategory(name: string, slug: string): Promise<string> {
  let category = await prisma.category.findUnique({ where: { slug } });
  
  if (!category) {
    category = await prisma.category.create({
      data: {
        name,
        slug,
        description: `Products in ${name}`,
      },
    });
    console.log(`  Created category: ${name}`);
  }
  
  return category.id;
}

async function getVendorId(email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { vendorProfile: true },
  });

  if (!user?.vendorProfile) {
    throw new Error(`Vendor profile not found for ${email}. Run setup-admin-vendor first.`);
  }

  return user.vendorProfile.id;
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

async function importProducts() {
  console.log('Starting WooCommerce import...\n');
  
  // Get vendor ID
  const vendorId = await getVendorId('admin@digistore1.com');
  console.log(`Using vendor ID: ${vendorId}\n`);

  let page = 1;
  let totalImported = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  while (true) {
    console.log(`Fetching page ${page}...`);
    const products = await fetchWooProducts(page);
    
    if (products.length === 0) {
      console.log('No more products to fetch.');
      break;
    }

    console.log(`Found ${products.length} products on page ${page}`);

    for (const wooProduct of products) {
      try {
        // Generate unique slug
        let slug = wooProduct.slug || wooProduct.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        // Check if product already exists
        const existing = await prisma.product.findUnique({ where: { slug } });
        if (existing) {
          console.log(`  Skipping "${wooProduct.name}" - already exists`);
          continue;
        }

        // Get or create category
        const category = wooProduct.categories[0];
        const categoryId = category 
          ? await getOrCreateCategory(category.name, category.slug)
          : await getOrCreateCategory('Uncategorized', 'uncategorized');

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
            status: ProductStatus.APPROVED,
            vendorId,
            rating: parseFloat(wooProduct.average_rating) || 0,
            reviewCount: wooProduct.rating_count || 0,
            downloadCount: wooProduct.total_sales || 0,
            publishedAt: new Date(wooProduct.date_created),
          },
        });

        console.log(`  ✓ Imported: ${wooProduct.name}`);
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

// Run the import
importProducts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

