import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { prisma, ensureDatabaseConnection, disconnectDatabase } from './lib/prisma';

// Import routes
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import orderRoutes from './routes/order.routes';
import vendorRoutes from './routes/vendor.routes';
import userRoutes from './routes/user.routes';
import reviewRoutes from './routes/review.routes';
import downloadRoutes from './routes/download.routes';
import paymentRoutes from './routes/payment.routes';
import adminSetupRoutes from './routes/admin-setup.routes';
import adminRoutes from './routes/admin.routes';
import referralRoutes from './routes/referral.routes';
import newsletterRoutes from './routes/newsletter.routes';
import attributeRoutes from './routes/attribute.routes';
import uploadRoutes from './routes/upload.routes';
import aiRoutes from './routes/ai.routes';
import settingsRoutes from './routes/settings.routes';
import bundleRoutes from './routes/bundle.routes';
import blogRoutes from './routes/blog.routes';
import couponRoutes from './routes/coupon.routes';
import giftCardRoutes from './routes/giftcard.routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet());

// CORS - Allow multiple origins
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:3000'];

// Log allowed origins on startup for debugging
console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list or if wildcard is set
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    }
    // Also allow Vercel preview deployments
    else if (origin.endsWith('.vercel.app')) {
      callback(null, true);
    }
    // Also allow digistore1.com domains (production)
    else if (origin.endsWith('digistore1.com')) {
      callback(null, true);
    }
    else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================
// ROUTES
// ============================================

// Health check (basic - for load balancers)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Deep health check (includes database) - use for monitoring
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await ensureDatabaseConnection(1, 500);
    if (dbConnected) {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: 'connected',
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: 'disconnected',
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/downloads', downloadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin-setup', adminSetupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/attributes', attributeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/bundles', bundleRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/gift-cards', giftCardRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

// Bind to 0.0.0.0 for Render deployment
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║   🚀 Digistore1 Backend API Server       ║
║                                           ║
║   Environment: ${process.env.NODE_ENV?.padEnd(27) || 'development'.padEnd(27)}║
║   Port: ${PORT.toString().padEnd(34)}║
║   Host: ${HOST.padEnd(34)}║
║                                           ║
╚═══════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    await disconnectDatabase();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;


