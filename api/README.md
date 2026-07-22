# E-commerce Ordering & Payment System API

A production-ready Express + TypeScript backend for an e-commerce platform with modular services, Prisma, Redis-backed category caching, JWT-based auth flow, and Stripe/bKash payment strategies.

## Project layout

The backend now lives under the api folder and uses a module-based structure:

```text
api/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── common/
│   ├── config/
│   ├── modules/
│   │   ├── auth/
│   │   ├── categories/
│   │   ├── orders/
│   │   ├── payments/
│   │   └── products/
│   └── types/
├── prisma/
├── docs/
└── package.json
```

## Tech stack

- Runtime: Node.js
- Language: TypeScript
- Framework: Express
- ORM: Prisma + PostgreSQL
- Cache/queue-like support: Redis
- Validation: Zod
- Logging: Pino
- Security: Helmet, CORS, rate limiting, JWT middleware

## Features

- Modular auth, product, order, category, and payment modules
- Atomic order and stock handling with Prisma transactions
- Stripe and bKash payment strategies
- Webhook handling with idempotency protection
- Redis-backed category tree caching
- Health check and structured error handling

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 16+
- Redis 7+

## Setup

1. Install dependencies

```bash
cd api
npm install
```

2. Create the environment file

```bash
cp .env.example .env
```

3. Start PostgreSQL and Redis (Docker Compose is included)

```bash
docker compose up -d postgres redis
```

4. Run Prisma migration and seed

```bash
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

5. Start the API

```bash
npm run dev
```

The API serves requests at http://localhost:4000/api.

## Available routes

- Health: GET /api/health
- Auth: POST /api/auth/register, POST /api/auth/login
- Products: GET /api/products, GET /api/products/:id, POST /api/products, PATCH /api/products/:id, DELETE /api/products/:id
- Orders: GET /api/orders, GET /api/orders/:id, POST /api/orders, PATCH /api/orders/:id/status, DELETE /api/orders/:id
- Payments: POST /api/payments/initiate, POST /api/payments/confirm, GET /api/payments/:id
- Categories: GET /api/categories/:id/tree, DELETE /api/categories/cache
- Webhooks: POST /api/payments/webhook/stripe, POST /api/payments/webhook/bkash

## Scripts

- npm run dev - start development server with nodemon
- npm run build - compile TypeScript
- npm start - run built server
- npm test - run Jest tests
- npm run prisma:generate - generate Prisma client
- npm run prisma:migrate:dev - run Prisma migrations in development
- npm run prisma:seed - run database seed

## Documentation

- OpenAPI spec: docs/openapi.yaml
- Architecture and flow diagrams: docs/architecture-and-flows.md

## License

ISC
