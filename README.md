# E-commerce Ordering & Payment System

A production-ready **Express.js + TypeScript** backend for an e-commerce platform featuring modular clean architecture, Prisma ORM, robust error handling, and security-first middleware.

## 🏗️ Architecture

The project follows **Modular Clean Architecture** — code is organized by domain modules rather than technical layers, promoting separation of concerns and maintainability.

```
src/
├── config/          # App configuration (env validation, logger, Prisma)
├── common/          # Shared utilities & middleware
│   ├── middleware/  # Error handler, rate limiter
│   └── utils/      # AppError hierarchy
├── types/           # Shared TypeScript types
└── modules/         # Domain modules
    ├── auth/        # Authentication (register, login, logout, refresh)
    ├── products/    # Product CRUD
    ├── orders/      # Order management
    └── payments/    # Payment processing & refunds
```

## 🚀 Tech Stack

| Layer              | Technology                              |
| ------------------ | --------------------------------------- |
| **Runtime**        | Node.js                                 |
| **Language**       | TypeScript (strict mode)                |
| **Framework**      | Express.js                              |
| **ORM**            | Prisma                                  |
| **Database**       | PostgreSQL                              |
| **Validation**     | Zod                                     |
| **Logging**        | Pino                                    |
| **Security**       | Helmet, CORS, express-rate-limit        |
| **Dev tooling**    | Nodemon, ESLint, Prettier               |

## ✨ Features

- **Modular architecture** — Auth, Products, Orders, Payments as isolated modules
- **Error handling** — Custom `AppError` class hierarchy with centralized async-aware middleware
- **Structured logging** — Pino with automatic secret redaction and dev-friendly pretty-printing
- **Security-first** — Helmet headers, strict CORS, rate limiting per route
- **Environment validation** — All env vars validated at startup via Zod schemas
- **Prisma ORM** — Type-safe database access with full schema (User, Product, Order, OrderItem, Payment)
- **Graceful shutdown** — Cleanly closes DB connections and HTTP server on SIGTERM/SIGINT

## 📋 Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **PostgreSQL** >= 14.x

## 🛠️ Setup

### 1. Clone & install

```bash
git clone https://github.com/hasanemam1717/E-commerce-Ordering-Payment-System.git
cd E-commerce-Ordering-Payment-System
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

| Variable                | Default                        | Description                    |
| ----------------------- | ------------------------------ | ------------------------------ |
| `NODE_ENV`              | `development`                  | Runtime environment            |
| `PORT`                  | `4000`                         | Server port                    |
| `DATABASE_URL`          | *(required)*                   | PostgreSQL connection string   |
| `CORS_ORIGIN`           | `http://localhost:3000`        | Allowed CORS origins           |
| `RATE_LIMIT_WINDOW_MS`  | `900000` (15 min)              | Rate limit window              |
| `RATE_LIMIT_MAX`        | `100`                          | Max requests per window        |
| `LOG_LEVEL`             | `info`                         | Pino log level                 |

### 3. Database setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Seed the database
npx prisma db seed
```

### 4. Start the server

```bash
# Development (with hot-reload)
npm run dev

# Build & run production
npm run build
npm start
```

The server starts at **http://localhost:4000**.

## 📡 API Endpoints

### Health

| Method | Path         | Description       |
| ------ | ------------ | ----------------- |
| GET    | `/api/health` | Health check      |

### Auth

| Method | Path                 | Description       |
| ------ | -------------------- | ----------------- |
| POST   | `/api/auth/register` | Register a user   |
| POST   | `/api/auth/login`    | Log in            |
| POST   | `/api/auth/logout`   | Log out           |
| POST   | `/api/auth/refresh`  | Refresh token     |

### Products

| Method | Path                  | Description          |
| ------ | --------------------- | -------------------- |
| GET    | `/api/products`       | List all products    |
| GET    | `/api/products/:id`   | Get product by ID    |
| POST   | `/api/products`       | Create a product     |
| PATCH  | `/api/products/:id`   | Update a product     |
| DELETE | `/api/products/:id`   | Delete a product     |

### Orders

| Method | Path                     | Description          |
| ------ | ------------------------ | -------------------- |
| GET    | `/api/orders`            | List all orders      |
| GET    | `/api/orders/:id`        | Get order by ID      |
| POST   | `/api/orders`            | Create an order      |
| PATCH  | `/api/orders/:id/status` | Update order status  |
| DELETE | `/api/orders/:id`        | Cancel an order      |

### Payments

| Method | Path                       | Description          |
| ------ | -------------------------- | -------------------- |
| POST   | `/api/payments/process`    | Process a payment    |
| GET    | `/api/payments/:id`        | Get payment by ID    |
| POST   | `/api/payments/:id/refund` | Refund a payment     |

## 🧪 Available Scripts

| Script                   | Description                          |
| ------------------------ | ------------------------------------ |
| `npm run dev`            | Start dev server with hot-reload     |
| `npm run build`          | Compile TypeScript to `dist/`        |
| `npm start`              | Run production build                 |
| `npm run lint`           | Lint all source files                |
| `npm run format`         | Format all source files with Prettier|
| `npm run prisma:generate`| Generate Prisma client               |
| `npm run prisma:migrate` | Run Prisma migrations                |
| `npm run prisma:studio`  | Open Prisma Studio                   |
| `npm run prisma:seed`    | Seed the database                    |

## 📄 License

ISC
