import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import * as migrationController from '../controllers/migration.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadImage } from '../middleware/upload';

const router = Router();

// TEMPORARY: Unprotected routes for migration - REMOVE AFTER USE
router.delete('/products/cleanup-all', adminController.deleteAllProductsPublic);
router.post('/products/bulk-import', adminController.createProductPublic);
router.put('/products/update-thumbnail', adminController.updateProductThumbnail);
router.post('/upload/image', uploadImage.single('image'), adminController.uploadImagePublic);
router.delete('/categories/:categoryId', adminController.deleteCategoryPublic);
router.post('/categories', adminController.createCategoryPublic);
router.delete('/products/:slug', adminController.deleteProductPublic);
router.get('/migration/status', migrationController.getMigrationStatus);
router.post('/migration/start', migrationController.startMigration);
// TEMPORARY: Stream download file (bypasses Cloudinary restrictions)
router.get('/products/:productId/download', adminController.streamDownloadFile);

// NEW: Category restructuring endpoints
router.delete('/categories/:categoryId/products', adminController.deleteProductsByCategoryPublic);
router.post('/products/move-category', adminController.moveProductsBetweenCategories);
router.delete('/categories/:categoryId/force', adminController.forceDeleteCategoryPublic);

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard stats
router.get('/dashboard/stats', adminController.getDashboardStats);

// Orders management
router.get('/orders', adminController.getAllOrders);

// Customers management
router.get('/customers', adminController.getAllCustomers);

// Vendors management
router.get('/vendors', adminController.getAllVendors);

// User management
router.patch('/users/:userId/status', adminController.updateUserStatus);

// Reviews management
router.get('/reviews', adminController.getAllReviews);
router.delete('/reviews/:reviewId', adminController.deleteReview);
router.patch('/reviews/:reviewId/toggle-verified', adminController.toggleReviewVerified);

// Product management (for bulk imports)
router.post('/products', adminController.createProductAdmin);

// Delete all products (for cleanup)
router.delete('/products/all', adminController.deleteAllProducts);

export default router;

