import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // ─── Users ──────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: '$2b$10$placeholder_hashed_password',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      password: '$2b$10$placeholder_hashed_password',
      firstName: 'John',
      lastName: 'Doe',
      role: Role.CUSTOMER,
    },
  });

  // ─── Products ───────────────────────────────────────
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'LAP-001' },
      update: {},
      create: {
        name: 'MacBook Pro 14"',
        description: 'Apple M3 chip, 16GB RAM',
        price: 1999.99,
        stock: 10,
        sku: 'LAP-001',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PHN-001' },
      update: {},
      create: {
        name: 'iPhone 16 Pro',
        description: '128GB, Titanium',
        price: 1099.99,
        stock: 25,
        sku: 'PHN-001',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'HDN-001' },
      update: {},
      create: {
        name: 'Sony WH-1000XM5',
        description: 'Wireless noise-cancelling headphones',
        price: 349.99,
        stock: 50,
        sku: 'HDN-001',
      },
    }),
  ]);

  console.log(`Seeded ${products.length} products`);
  console.log(`Seeded admin: ${admin.email}`);
  console.log(`Seeded customer: ${customer.email}`);
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
