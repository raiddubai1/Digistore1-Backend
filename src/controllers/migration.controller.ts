/**
 * Migration Controller - WooCommerce product import via API endpoint
 */
import { Request, Response } from 'express';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../lib/prisma';
import { ProductStatus } from '@prisma/client';

// Configuration
const WOOCOMMERCE_URL = process.env.WOOCOMMERCE_URL || 'https://digistore1.com';
const WOOCOMMERCE_KEY = process.env.WOOCOMMERCE_KEY || 'ck_15e3f0107fda4ef024edce9e688d7d9c84f70547';
const WOOCOMMERCE_SECRET = process.env.WOOCOMMERCE_SECRET || 'cs_041219985a4000782bdcca1e259e11cb6c53e3c9';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'donkzbuyp',
  api_key: process.env.CLOUDINARY_API_KEY || '281985365816781',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mmdvkGNnW6QxzgwYGznYsvYtLws',
});

const categoryMap = new Map<number, string>();
const uploadedImages = new Map<string, string>();

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

async function uploadToCloudinary(url: string, folder: string): Promise<string> {
  if (!url) return '';
  if (uploadedImages.has(url)) return uploadedImages.get(url)!;
  try {
    const result = await cloudinary.uploader.upload(url, {
      folder: `digistore1/${folder}`,
      resource_type: 'auto',
      timeout: 120000,
      access_mode: 'public',
      type: 'upload',
    });
    uploadedImages.set(url, result.secure_url);
    return result.secure_url;
  } catch (e) { return url; }
}

export const getMigrationStatus = async (req: Request, res: Response) => {
  const productCount = await prisma.product.count();
  const categoryCount = await prisma.category.count();
  res.json({ status: 'ready', currentProducts: productCount, currentCategories: categoryCount, woocommerceUrl: WOOCOMMERCE_URL });
};

export const startMigration = async (req: Request, res: Response) => {
  try {
    console.log('Starting WooCommerce Migration...');

    // Get or create vendor
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      const bcrypt = await import('bcryptjs');
      admin = await prisma.user.create({
        data: { email: 'admin@digistore1.com', password: await bcrypt.hash('Admin123!', 10), name: 'Digistore1 Admin', role: 'ADMIN', status: 'ACTIVE', emailVerified: true },
      });
    }
    let vendor = await prisma.vendorProfile.findUnique({ where: { userId: admin.id } });
    if (!vendor) {
      vendor = await prisma.vendorProfile.create({
        data: { userId: admin.id, businessName: 'Digistore1 Official', businessEmail: admin.email, description: 'Official Products', verified: true },
      });
    }

    // Migrate categories
    console.log('Migrating categories...');
    const catRes = await axios.get(`${WOOCOMMERCE_URL}/wp-json/wc/v3/products/categories`, {
      auth: { username: WOOCOMMERCE_KEY, password: WOOCOMMERCE_SECRET }, params: { per_page: 100 },
    });
    const wooCats = catRes.data.sort((a: any, b: any) => a.parent - b.parent);

    for (const wc of wooCats) {
      try {
        const parentId = wc.parent > 0 ? categoryMap.get(wc.parent) : null;
        const imageUrl = wc.image?.src ? await uploadToCloudinary(wc.image.src, 'categories') : null;
        const cat = await prisma.category.create({
          data: { name: wc.name, slug: wc.slug + '-' + Date.now().toString(36).slice(-4), description: stripHtml(wc.description) || null, image: imageUrl, parentId, active: true },
        });
        categoryMap.set(wc.id, cat.id);
        console.log(`Category: ${wc.name}`);
      } catch (e: any) { console.log(`Category ${wc.name}: ${e.message}`); }
    }

    res.json({ status: 'started', message: 'Categories imported. Products importing in background...', categoriesImported: categoryMap.size });
    migrateProducts(vendor.id);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

async function migrateProducts(vendorId: string) {
  console.log('Migrating products...');
  let fallbackCatId = categoryMap.values().next().value;
  if (!fallbackCatId) {
    const cat = await prisma.category.create({ data: { name: 'Uncategorized', slug: 'uncategorized-' + Date.now(), active: true } });
    fallbackCatId = cat.id;
  }

  let page = 1, total = 0;
  while (true) {
    const resp = await axios.get(`${WOOCOMMERCE_URL}/wp-json/wc/v3/products`, {
      auth: { username: WOOCOMMERCE_KEY, password: WOOCOMMERCE_SECRET }, params: { page, per_page: 20 },
    });
    if (resp.data.length === 0) break;

    for (const woo of resp.data) {
      try {
        const thumb = woo.images?.[0]?.src ? await uploadToCloudinary(woo.images[0].src, 'products') : '';
        const previews: string[] = [];
        for (const img of (woo.images || [])) previews.push(await uploadToCloudinary(img.src, 'products'));

        let fileUrl = '', fileName = 'product-file';
        if (woo.downloads?.[0]?.file) {
          fileUrl = await uploadToCloudinary(woo.downloads[0].file, 'downloads');
          fileName = woo.downloads[0].name || fileName;
        }

        const price = parseFloat(woo.price) || 0;
        const regPrice = parseFloat(woo.regular_price) || price;
        const catId = woo.categories?.[0]?.id && categoryMap.has(woo.categories[0].id) ? categoryMap.get(woo.categories[0].id)! : fallbackCatId;

        await prisma.product.create({
          data: {
            title: woo.name, slug: woo.slug + '-' + Date.now().toString(36).slice(-4),
            description: stripHtml(woo.description) || woo.name, shortDescription: stripHtml(woo.short_description) || '',
            price, originalPrice: regPrice > price ? regPrice : null, discount: regPrice > price ? Math.round((1 - price / regPrice) * 100) : 0,
            categoryId: catId, tags: (woo.tags || []).map((t: any) => t.name), fileType: woo.downloadable ? 'pdf' : 'digital',
            fileUrl, fileName, thumbnailUrl: thumb, previewImages: previews, featured: woo.featured, bestseller: woo.total_sales > 10,
            newArrival: true, status: ProductStatus.APPROVED, vendorId, rating: parseFloat(woo.average_rating) || 0,
            reviewCount: woo.rating_count || 0, downloadCount: woo.total_sales || 0, publishedAt: new Date(woo.date_created),
          },
        });
        console.log(`Product: ${woo.name}`);
        total++;
      } catch (e: any) { console.log(`Product ${woo.name}: ${e.message}`); }
    }
    page++;
  }
  console.log(`Migration complete! ${total} products imported.`);
}
