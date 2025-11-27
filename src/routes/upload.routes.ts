import { Router } from 'express';
import * as uploadController from '../controllers/upload.controller';
import { uploadImage, uploadProductFile, uploadImages } from '../middleware/upload';
import { authenticate } from '../middleware/auth';

const router = Router();

// All upload routes require authentication
router.use(authenticate);

// Upload single image
router.post('/image', uploadImage.single('image'), uploadController.uploadImage);

// Upload multiple images
router.post('/images', uploadImages, uploadController.uploadImages);

// Upload product file
router.post('/product-file', uploadProductFile.single('file'), uploadController.uploadProductFile);

// Delete image
router.delete('/image', uploadController.deleteImage);

export default router;

