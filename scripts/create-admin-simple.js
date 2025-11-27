// Simple script to create admin user
// Run with: node scripts/create-admin-simple.js
//
// To use with Render database, set DATABASE_URL environment variable:
// DATABASE_URL="your-render-database-url" node scripts/create-admin-simple.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  const email = 'admin@digistore1.com';
  const password = 'Admin123!';
  const name = 'Admin User';

  try {
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      console.log('❌ User already exists!');
      console.log('Email:', existing.email);
      console.log('Current Role:', existing.role);
      
      if (existing.role !== 'ADMIN') {
        // Update to admin
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'ADMIN' }
        });
        console.log('✅ Updated role to ADMIN');
      }
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hashSync(password, 10);

    // Create admin
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });

    console.log('✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', name);
    console.log('🎭 Role:', admin.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🌐 Login at: https://digistore-frontend.vercel.app/en/login');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

