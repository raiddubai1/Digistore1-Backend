-- Create admin user for Digistore1
-- Password: Admin123! (hashed with bcrypt, 10 rounds)
-- Run this in your PostgreSQL database

INSERT INTO "User" (
  id,
  email,
  password,
  name,
  role,
  status,
  "emailVerified",
  "emailVerifiedAt",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'admin@digistore1.com',
  '$2a$10$YQ7jZ5vXqKZH5vXqKZH5vOqKZH5vXqKZH5vXqKZH5vXqKZH5vXqKZ',  -- This is a placeholder, we need to generate the real hash
  'Admin User',
  'ADMIN',
  'ACTIVE',
  true,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'ADMIN',
  status = 'ACTIVE',
  "emailVerified" = true,
  "emailVerifiedAt" = NOW();

