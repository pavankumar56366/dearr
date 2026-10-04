# Dearr — Luxury Minimalist E-Commerce Platform

A production-ready luxury minimalist e-commerce storefront and administration suite for luxury fashion and lifestyle products, built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and MySQL on Hostinger.

---

## 🌟 Features

### Customer Storefront
- **Modern Minimalist UI**: Curated typography, refined spacing, and subtle micro-interactions designed for a luxury aesthetic.
- **Product Catalog**: Filter by category, price, in-stock status, and sort by price or newest releases.
- **Product Detail**: Rich gallery previews, variant selector (size/color), real-time stock availability, and accordion specifications.
- **Shopping Cart & Wishlist**: Persistent cart and wishlist with optimistic state updates and inventory checks.
- **Multi-Step Checkout**: Shipping address validation, coupon/discount code redemption, and multiple payment methods.
- **Order Tracking & Account**: Real-time order timeline, shipping snapshots, and order history with download/print capabilities.

### Authentication & Security
- **Dual Authentication**: Native email/password authentication (bcrypt-hashed) alongside Google OAuth 2.0 / OpenID Connect.
- **Zero Third-Party Dependency**: Direct cryptographic JWKS verification with `jose` — no third-party auth vendors.
- **State & Session Security**: 256-bit cryptographically secure state tokens, HttpOnly same-site session cookies, and strict CSRF protection.
- **Role-Based Access Control**: Strict database-level customer vs. admin authorization checks.

### Payments Integration
- **Razorpay**: Full end-to-end payment gateway flow with order creation, cryptographic HMAC SHA256 signature verification, and settlement hooks.
- **Cash on Delivery (COD)**: Alternative direct fulfillment option with validation.

### Admin Suite
- **Executive Dashboard**: Real-time sales metrics, revenue analytics, order volume, and low-stock alerts.
- **Catalog Management**: Full CRUD for products, SKU variants, inventory tracking, and categories.
- **Order Management**: Order inspection, fulfillment workflow, status transitions (Pending, Processing, Shipped, Delivered, Cancelled).
- **Customer & Review Management**: Customer directory, order histories, review moderation, and system settings.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Components & Server Actions)
- **Frontend**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Database**: MySQL on Hostinger (`mysql2`)
- **Authentication**: JWT sessions with `jose`, `bcryptjs`, Google OAuth 2.0
- **Payments**: [Razorpay Node SDK](https://razorpay.com/)
- **Validation**: [Zod 4](https://zod.dev/)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- MySQL 8+ database instance

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pavankumar56366/dearr.git
   cd dearr
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` and provide your database credentials, JWT secret, and optional integration keys:
   ```bash
   cp .env.example .env.local
   ```

4. **Database Migration**:
   Run the schema migration scripts to set up the database tables:
   ```bash
   npx tsx database/run-migration.ts
   npx tsx database/run-migration-002-google-oauth.ts
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server |
| `npm run build` | Compiles the production build (116+ routes) |
| `npm run start` | Runs the built production server |
| `npm run lint` | Runs ESLint validation |

---

## 📄 License

Private & Proprietary. All rights reserved.