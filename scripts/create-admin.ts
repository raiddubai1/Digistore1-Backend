import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const email = 'joel@digistore1.com';
    const password = 'JoelAdmin2024!';
    const name = 'Joel Admin';

    // First, list all existing admins
    const existingAdmins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true },
    });

    console.log('\n📋 Existing admin users:');
    if (existingAdmins.length > 0) {
      existingAdmins.forEach((admin) => {
        console.log(`   - ${admin.email} (${admin.name})`);
      });
    } else {
      console.log('   None found');
    }

    // Check if this specific admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (existingAdmin) {
      // Update the password
      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
      console.log('\n✅ Admin password reset successfully!');
    } else {
      // Create new admin user
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
      console.log('\n✅ New admin user created successfully!');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 YOUR NEW LOGIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

