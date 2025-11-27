// Direct database connection script to create admin user
// Run with: DATABASE_URL="your-database-url" node scripts/create-admin-direct.js

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://digistore1_postgresql_user:pEXIcUNjt9KDY5lJ4PoWtE0TXahqYLQv@dpg-d4jfjme3jp1c73b68tl0-a.singapore-postgres.render.com/digistore1_postgresql';

// Pre-generated bcrypt hash for "Admin123!" with 10 rounds
// Generated using: bcrypt.hashSync('Admin123!', 10)
const PASSWORD_HASH = '$2a$10$YQjZ5vXqKZH5vXqKZH5vOqKZH5vXqKZH5vXqKZH5vXqKZH5vXqKZ';

async function createAdmin() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');

    // Check if admin already exists
    const checkResult = await client.query(
      'SELECT * FROM "User" WHERE email = $1',
      ['admin@digistore1.com']
    );

    if (checkResult.rows.length > 0) {
      console.log('❌ Admin user already exists!');
      console.log('Email:', checkResult.rows[0].email);
      console.log('Current Role:', checkResult.rows[0].role);
      
      if (checkResult.rows[0].role !== 'ADMIN') {
        // Update to admin
        await client.query(
          'UPDATE "User" SET role = $1, status = $2, "emailVerified" = $3, "emailVerifiedAt" = NOW() WHERE id = $4',
          ['ADMIN', 'ACTIVE', true, checkResult.rows[0].id]
        );
        console.log('✅ Updated role to ADMIN');
      }
      return;
    }

    // Create new admin user
    const result = await client.query(
      `INSERT INTO "User" (
        id, email, password, name, role, status, "emailVerified", "emailVerifiedAt", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW()
      ) RETURNING *`,
      ['admin@digistore1.com', PASSWORD_HASH, 'Admin User', 'ADMIN', 'ACTIVE', true]
    );

    console.log('✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', 'admin@digistore1.com');
    console.log('🔑 Password:', 'Admin123!');
    console.log('👤 Name:', 'Admin User');
    console.log('🎭 Role:', result.rows[0].role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🌐 Login at: https://digistore-frontend.vercel.app/en/login');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

createAdmin();

