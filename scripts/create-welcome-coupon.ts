import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createWelcomeCoupon() {
  try {
    // Check if WELCOME30 already exists
    const existing = await prisma.coupon.findUnique({
      where: { code: 'WELCOME30' },
    });

    if (existing) {
      console.log('WELCOME30 coupon already exists:', existing);
      // Make sure it's active
      if (!existing.active) {
        await prisma.coupon.update({
          where: { code: 'WELCOME30' },
          data: { active: true },
        });
        console.log('Activated WELCOME30 coupon');
      }
      return;
    }

    // Create WELCOME30 coupon
    const coupon = await prisma.coupon.create({
      data: {
        code: 'WELCOME30',
        type: 'PERCENTAGE',
        value: 30,
        active: true,
        firstPurchaseOnly: true,
      },
    });

    console.log('Created WELCOME30 coupon:', coupon);

    // Also create other commonly used coupons if they don't exist
    const otherCoupons = [
      { code: 'SAVE10', type: 'PERCENTAGE' as const, value: 10 },
      { code: 'SAVE20', type: 'PERCENTAGE' as const, value: 20 },
      { code: 'FLAT5', type: 'FIXED' as const, value: 5 },
    ];

    for (const c of otherCoupons) {
      const exists = await prisma.coupon.findUnique({ where: { code: c.code } });
      if (!exists) {
        await prisma.coupon.create({
          data: {
            code: c.code,
            type: c.type,
            value: c.value,
            active: true,
          },
        });
        console.log(`Created ${c.code} coupon`);
      }
    }

    console.log('All coupons created successfully!');
  } catch (error) {
    console.error('Error creating coupons:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createWelcomeCoupon();

