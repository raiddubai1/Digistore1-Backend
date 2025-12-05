import axios from 'axios';

const API_URL = 'https://digistore1-backend.onrender.com';
const ADMIN_SECRET = 'cleanup-digistore1-2024';

async function setFreeProducts() {
  // Get all products
  const response = await axios.get(`${API_URL}/api/products?limit=200`);
  const products = response.data.data.products;
  
  // Filter Pets & Animals category (dog ebooks)
  const dogProducts = products.filter((p: any) => p.category?.name === 'Pets & Animals');
  
  console.log(`Found ${dogProducts.length} dog eBook products to set as FREE`);
  
  let success = 0;
  let errors = 0;
  
  for (let i = 0; i < dogProducts.length; i++) {
    const product = dogProducts[i];
    try {
      await axios.put(
        `${API_URL}/api/admin/products/update-thumbnail`,
        { slug: product.slug, price: 0 },
        { headers: { 'x-admin-secret': ADMIN_SECRET } }
      );
      console.log(`[${i + 1}/${dogProducts.length}] ✓ ${product.slug}`);
      success++;
    } catch (error: any) {
      console.log(`[${i + 1}/${dogProducts.length}] ✗ ${product.slug}: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\nComplete! Success: ${success}, Errors: ${errors}`);
}

setFreeProducts();
