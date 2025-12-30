import { Router } from 'express';
import { body, query } from 'express-validator';
import * as productController from '../controllers/product.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Public routes
router.get('/', optionalAuth, productController.getAllProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/bestsellers', productController.getBestsellers);
router.get('/new-arrivals', productController.getNewArrivals);
router.get('/suggestions', productController.getProductSuggestions);
router.get('/by-id/:id', optionalAuth, productController.getProductById);
router.get('/:slug', optionalAuth, productController.getProductBySlug);

// Protected routes - Vendor only
router.post(
  '/',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  [
    body('title').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('categoryId').notEmpty(),
    // fileType and fileUrl are optional for Canva-only products
    body('fileType').optional(),
    body('fileUrl').optional(),
    body('thumbnailUrl').notEmpty(),
    // Custom validation: require either fileUrl OR canvaTemplateLinks
    body().custom((value) => {
      const hasFileUrl = value.fileUrl && value.fileUrl.trim() !== '';
      const hasCanvaLinks = value.canvaTemplateLinks && value.canvaTemplateLinks.length > 0;
      const hasLegacyCanvaLink = value.canvaTemplateLink && value.canvaTemplateLink.trim() !== '';
      if (!hasFileUrl && !hasCanvaLinks && !hasLegacyCanvaLink) {
        throw new Error('Either fileUrl or canvaTemplateLinks is required');
      }
      return true;
    }),
  ],
  validate,
  productController.createProduct
);

router.put(
  '/:id',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  productController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  productController.deleteProduct
);

// Admin only
router.patch(
  '/:id/approve',
  authenticate,
  authorize('ADMIN'),
  productController.approveProduct
);

router.patch(
  '/:id/reject',
  authenticate,
  authorize('ADMIN'),
  [body('reason').trim().notEmpty()],
  validate,
  productController.rejectProduct
);

// Bulk import endpoint (uses secret key instead of JWT)
router.post(
  '/bulk-import',
  productController.bulkImportProducts
);

// Bulk update thumbnails endpoint (uses secret key instead of JWT)
router.post(
  '/bulk-update-thumbnails',
  productController.bulkUpdateThumbnails
);

export default router;

