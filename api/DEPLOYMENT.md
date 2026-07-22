# Deployment Guide

This guide covers local and staging deployment for the backend using Docker Compose, plus frontend deployment guidance for Vercel and webhook testing with ngrok.

---

## 1. Backend Deployment with Docker Compose

### Prerequisites

- Docker Engine 24+
- Docker Compose v2+
- Node.js 20+ (optional, only for local development outside Docker)

### Step 1: Create environment file

Copy the example file and update the values:

```bash
cp .env.example .env
```

Use strong values for secrets such as JWT and payment provider credentials.

### Step 2: Start the stack

```bash
docker compose up -d --build
```

This starts:

- API backend on port 4000
- PostgreSQL on port 55432
- Redis on port 6379

### Step 3: Run Prisma migrations

```bash
docker compose exec app npx prisma migrate deploy
```

### Step 4: Seed the database (optional)

```bash
docker compose exec app npm run prisma:seed
```

### Step 5: Verify the deployment

```bash
curl http://localhost:4000/api/health
```

Expected response:

```json
{ "status": "ok" }
```

### Useful commands

```bash
docker compose ps
docker compose logs -f app
docker compose down
docker compose down -v
```

---

## 2. Local / Staging Webhook Testing with ngrok

Webhook endpoints need a public URL so Stripe and bKash can reach them.

### Step 1: Start ngrok

```bash
ngrok http 4000
```

Copy the generated HTTPS URL, for example:

```text
https://abc123.ngrok-free.app
```

### Step 2: Configure webhook endpoint URLs

Set your provider webhook URLs to:

- Stripe: `https://abc123.ngrok-free.app/api/payments/webhook/stripe`
- bKash: `https://abc123.ngrok-free.app/api/payments/webhook/bkash`

### Step 3: Update environment variables

Set the public backend URL in your environment, or ensure the app can resolve it via your deployment config.

Example:

```env
CORS_ORIGIN=https://your-frontend.vercel.app
```

For payment providers, set the callback URL to the public ngrok address in your provider dashboard.

---

## 3. Environment Variables Matrix

Create a production-safe `.env` file with the values below.

| Variable                 | Required | Description                   | Example                                                               |
| ------------------------ | -------- | ----------------------------- | --------------------------------------------------------------------- |
| `NODE_ENV`               | Yes      | Runtime environment           | `production`                                                          |
| `PORT`                   | Yes      | Application port              | `4000`                                                                |
| `HOST`                   | Yes      | Bind host                     | `0.0.0.0`                                                             |
| `DATABASE_URL`           | Yes      | PostgreSQL connection string  | `postgresql://user:password@postgres:5432/ecommerce_db?schema=public` |
| `CORS_ORIGIN`            | Yes      | Allowed frontend origin       | `https://your-app.vercel.app`                                         |
| `RATE_LIMIT_WINDOW_MS`   | No       | Rate limit window in ms       | `900000`                                                              |
| `RATE_LIMIT_MAX`         | No       | Max requests per window       | `100`                                                                 |
| `LOG_LEVEL`              | No       | Logging verbosity             | `info`                                                                |
| `REDIS_URL`              | Yes      | Redis connection string       | `redis://redis:6379`                                                  |
| `JWT_SECRET`             | Yes      | Secret used to sign JWTs      | `super-long-random-secret`                                            |
| `JWT_ACCESS_EXPIRES_IN`  | No       | Access token TTL              | `15m`                                                                 |
| `JWT_REFRESH_EXPIRES_IN` | No       | Refresh token TTL             | `7d`                                                                  |
| `STRIPE_SECRET_KEY`      | No       | Stripe secret API key         | `sk_live_...`                                                         |
| `STRIPE_WEBHOOK_SECRET`  | No       | Stripe webhook signing secret | `whsec_...`                                                           |
| `BKASH_BASE_URL`         | No       | bKash API base URL            | `https://tokenized.sandbox.bka.sh/v1.2.0-beta`                        |
| `BKASH_APP_KEY`          | No       | bKash app key                 | `...`                                                                 |
| `BKASH_APP_SECRET`       | No       | bKash app secret              | `...`                                                                 |
| `BKASH_USERNAME`         | No       | bKash username                | `...`                                                                 |
| `BKASH_PASSWORD`         | No       | bKash password                | `...`                                                                 |

### Example `.env.example`

```env
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

DATABASE_URL=postgresql://ecommerce_user:ecommerce_password@postgres:5432/ecommerce_db?schema=public
CORS_ORIGIN=https://your-frontend.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
REDIS_URL=redis://redis:6379

JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

BKASH_BASE_URL=https://tokenized.sandbox.bka.sh/v1.2.0-beta
BKASH_APP_KEY=your_bkash_app_key
BKASH_APP_SECRET=your_bkash_app_secret
BKASH_USERNAME=your_bkash_username
BKASH_PASSWORD=your_bkash_password
```

---

## 4. Vercel Frontend Deployment

The frontend should be deployed on Vercel and configured to point at the backend base URL.

### Environment variable on Vercel

Set:

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.example.com
```

If you are using ngrok for local or staging testing, use the ngrok HTTPS URL instead:

```env
NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app
```

### Notes

- The frontend should call the backend using `NEXT_PUBLIC_API_URL` for API requests.
- Make sure the backend CORS origin allows the frontend domain.
- For production, replace the ngrok URL with your permanent backend hostname.

---

## 5. Production Hardening Checklist

- Use real secrets and rotate them regularly.
- Enable HTTPS on the backend and frontend.
- Restrict database and Redis access to application containers only.
- Add monitoring, alerts, and log aggregation.
- Configure backup strategy for PostgreSQL volumes.
- Prefer managed PostgreSQL and Redis in staging/production over local containers.
