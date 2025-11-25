# Digistore1 Backend API

Digital products marketplace backend built with Node.js, Express, PostgreSQL, and Prisma.

## 🚀 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT
- **Payment**: Stripe
- **File Storage**: AWS S3
- **Email**: Nodemailer

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- npm or yarn package manager

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `STRIPE_SECRET_KEY` - Stripe API key
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `EMAIL_HOST` - SMTP server details

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database with demo data
npm run prisma:seed

# Open Prisma Studio (optional)
npm run prisma:studio
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:5000`

## 📁 Project Structure

```
digistore1-backend/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts            # Seed data
├── src/
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Express middleware
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   ├── lib/              # Libraries (Prisma, etc.)
│   └── server.ts         # Main server file
├── .env.example          # Environment variables template
├── package.json
└── tsconfig.json
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/featured` - Get featured products
- `GET /api/products/bestsellers` - Get bestsellers
- `GET /api/products/:slug` - Get product by slug
- `POST /api/products` - Create product (Vendor)
- `PUT /api/products/:id` - Update product (Vendor)
- `DELETE /api/products/:id` - Delete product (Vendor)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:slug` - Get category by slug

### Orders
- `GET /api/orders/my-orders` - Get user's orders
- `GET /api/orders/:id` - Get order by ID
- `POST /api/orders` - Create order

### Vendor
- `GET /api/vendors/dashboard/stats` - Dashboard statistics
- `GET /api/vendors/products` - Vendor's products
- `GET /api/vendors/sales` - Sales data
- `GET /api/vendors/payouts` - Payout history

### User
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/wishlist` - Get wishlist
- `POST /api/users/wishlist/:productId` - Add to wishlist
- `DELETE /api/users/wishlist/:productId` - Remove from wishlist

### Reviews
- `GET /api/reviews/product/:productId` - Get product reviews
- `POST /api/reviews` - Create review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

### Downloads
- `POST /api/downloads/generate/:orderItemId` - Generate download link
- `GET /api/downloads/:token` - Download file

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-token>
```

## 🧪 Testing

```bash
npm test
```

## 📦 Production Build

```bash
npm run build
npm start
```

## 📝 License

MIT

