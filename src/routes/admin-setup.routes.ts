import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../utils/password';

const router = Router();

// Special endpoint to create admin user (should be disabled in production)
router.post('/create-admin', async (req, res) => {
  try {
    const { email, password, name, secretKey } = req.body;

    // Simple security check - require a secret key
    if (secretKey !== process.env.ADMIN_SETUP_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Invalid secret key',
      });
    }

    // Check if admin already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      // Update to admin if exists
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { 
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: 'User updated to ADMIN role',
        data: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
        },
      });
    }

    // Create new admin user
    const hashedPassword = await hashPassword(password);

    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error: any) {
    console.error('Admin creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create admin user',
    });
  }
});

export default router;

