import { Router, Request, Response } from 'express';
import {
  getAttributes,
  getAttribute,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  getProductAttributes,
  setProductAttributes,
} from '../controllers/attribute.controller';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// TEMPORARY: Seed default attributes
router.post('/seed', async (req: Request, res: Response) => {
  try {
    const defaultAttributes = [
      { name: 'File Format', slug: 'file-format', type: 'SELECT', options: ['PDF', 'DOCX', 'XLSX', 'ZIP', 'PSD', 'AI', 'FIGMA', 'SKETCH'], required: false, order: 1 },
      { name: 'License Type', slug: 'license-type', type: 'SELECT', options: ['Personal Use', 'Commercial Use', 'Extended License', 'Unlimited'], required: false, order: 2 },
      { name: 'Compatibility', slug: 'compatibility', type: 'MULTISELECT', options: ['Windows', 'Mac', 'Linux', 'iOS', 'Android', 'Web'], required: false, order: 3 },
      { name: 'Software Required', slug: 'software-required', type: 'TEXT', options: [], required: false, order: 4 },
      { name: 'Version', slug: 'version', type: 'TEXT', options: [], required: false, order: 5 },
      { name: 'Number of Pages', slug: 'number-of-pages', type: 'NUMBER', options: [], required: false, order: 6 },
    ];

    const created = [];
    for (const attr of defaultAttributes) {
      const existing = await prisma.attribute.findUnique({ where: { slug: attr.slug } });
      if (!existing) {
        const newAttr = await prisma.attribute.create({ data: attr as any });
        created.push(newAttr);
      }
    }

    res.json({ success: true, message: `Created ${created.length} attributes`, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Attribute routes (Admin only)
router.get('/', getAttributes);
router.get('/:id', getAttribute);
router.post('/', authenticate, authorize('ADMIN'), createAttribute);
router.put('/:id', authenticate, authorize('ADMIN'), updateAttribute);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteAttribute);

// Product attribute routes
router.get('/product/:productId', getProductAttributes);
router.post('/product/:productId', authenticate, authorize('ADMIN', 'VENDOR'), setProductAttributes);

export default router;

