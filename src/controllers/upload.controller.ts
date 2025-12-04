import { Request, Response, NextFunction } from 'express';
import cloudinary from '../config/cloudinary';
import { AppError } from '../middleware/errorHandler';
import streamifier from 'streamifier';
import { uploadToS3 } from '../config/s3';

// Upload single image
export const uploadImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'digistore1/images',
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      streamifier.createReadStream(req.file!.buffer).pipe(uploadStream);
    });

    res.json({
      success: true,
      data: {
        url: (result as any).secure_url,
        publicId: (result as any).public_id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Upload multiple images
export const uploadImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new AppError('No files uploaded', 400);
    }

    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'digistore1/images',
            resource_type: 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve({
              url: result!.secure_url,
              publicId: result!.public_id,
            });
          }
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    });

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      data: {
        images: results,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Upload product file to S3
export const uploadProductFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    // Generate unique key for S3
    const timestamp = Date.now();
    const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `products/${timestamp}-${sanitizedFileName}`;

    // Upload to S3
    const result = await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);

    res.json({
      success: true,
      data: {
        url: result.url,
        key: result.key,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete image
export const deleteImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      throw new AppError('Public ID is required', 400);
    }

    await cloudinary.uploader.destroy(publicId);

    res.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

