import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Default settings structure
const DEFAULT_SETTINGS = {
  // General
  storeName: 'Digistore1',
  storeTagline: 'Your Digital Products Marketplace',
  storeEmail: 'contact@digistore1.com',
  storePhone: '',
  storeAddress: '',
  storeLogo: '',
  storeFavicon: '',
  // Payment
  currency: 'USD',
  currencySymbol: '$',
  stripeEnabled: false,
  stripePublicKey: '',
  stripeSecretKey: '',
  paypalEnabled: false,
  paypalClientId: '',
  paypalSecretKey: '',
  // Email
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: 'Digistore1',
  // Notifications
  emailOrderConfirmation: true,
  emailNewOrder: true,
  emailLowStock: false,
  emailNewReview: true,
  // Security
  sessionTimeout: '24',
  maxLoginAttempts: '5',
  requireEmailVerification: true,
  allowGuestCheckout: false,
  // Menu Items - Main navigation
  menuItems: [
    { id: '1', label: 'Home', href: '/', enabled: true, order: 0 },
    { id: '2', label: 'Shop', href: '/products', enabled: true, order: 1 },
    { id: '3', label: 'Categories', href: '/categories', enabled: true, order: 2 },
    { id: '4', label: 'New Arrivals', href: '/products?sort=newest', enabled: true, order: 3 },
    { id: '5', label: 'Best Sellers', href: '/products?sort=bestsellers', enabled: true, order: 4 },
  ],
};

// Get all settings
export const getAllSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const settings = await prisma.setting.findMany();
    
    // Convert to key-value object
    const settingsObj: Record<string, any> = { ...DEFAULT_SETTINGS };
    settings.forEach(s => {
      try {
        settingsObj[s.key] = JSON.parse(s.value);
      } catch {
        settingsObj[s.key] = s.value;
      }
    });

    res.json({
      success: true,
      data: settingsObj,
    });
  } catch (error) {
    next(error);
  }
};

// Get public settings (non-sensitive)
export const getPublicSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const publicKeys = [
      'storeName', 'storeTagline', 'storeEmail', 'storePhone', 'storeAddress',
      'storeLogo', 'storeFavicon', 'currency', 'currencySymbol',
      'stripeEnabled', 'stripePublicKey', 'paypalEnabled', 'allowGuestCheckout',
      'menuItems'
    ];

    const settings = await prisma.setting.findMany({
      where: { key: { in: publicKeys } }
    });

    const settingsObj: Record<string, any> = {};
    publicKeys.forEach(key => {
      settingsObj[key] = (DEFAULT_SETTINGS as any)[key];
    });
    
    settings.forEach(s => {
      try {
        settingsObj[s.key] = JSON.parse(s.value);
      } catch {
        settingsObj[s.key] = s.value;
      }
    });

    res.json({
      success: true,
      data: settingsObj,
    });
  } catch (error) {
    next(error);
  }
};

// Update settings
export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const updates = req.body;

    // Upsert each setting
    const operations = Object.entries(updates).map(([key, value]) => {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      return prisma.setting.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue },
      });
    });

    await prisma.$transaction(operations);

    res.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Update a single setting
export const updateSetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const { key } = req.params;
    const { value } = req.body;

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    await prisma.setting.upsert({
      where: { key },
      update: { value: stringValue },
      create: { key, value: stringValue },
    });

    res.json({
      success: true,
      message: `Setting "${key}" updated successfully`,
    });
  } catch (error) {
    next(error);
  }
};

