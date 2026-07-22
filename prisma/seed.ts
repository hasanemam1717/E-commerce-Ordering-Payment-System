import { PrismaClient, Role, ProductStatus, PaymentProvider } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...\n');

  // ─── Users (real bcrypt hashes) ─────────────────────
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const customerPasswordHash = await bcrypt.hash('customer123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: { passwordHash: customerPasswordHash },
    create: {
      email: 'customer@example.com',
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
    },
  });

  console.log(`👤 Users: ${admin.email} (ADMIN) / ${customer.email} (CUSTOMER)`);

  // ─── Categories (hierarchical) ──────────────────────
  const electronics = await prisma.category.create({
    data: { name: 'Electronics', slug: 'electronics' },
  });

  const laptops = await prisma.category.create({
    data: { name: 'Laptops', slug: 'laptops', parentId: electronics.id },
  });

  const smartphones = await prisma.category.create({
    data: { name: 'Smartphones', slug: 'smartphones', parentId: electronics.id },
  });

  const audio = await prisma.category.create({
    data: { name: 'Audio', slug: 'audio', parentId: electronics.id },
  });

  console.log(
    `📂 Categories: ${electronics.name} → ${laptops.name}, ${smartphones.name}, ${audio.name}`,
  );

  // ─── Products ───────────────────────────────────────
  const macbook = await prisma.product.upsert({
    where: { sku: 'LAP-001' },
    update: {},
    create: {
      name: 'MacBook Pro 14"',
      sku: 'LAP-001',
      description: 'Apple M3 chip, 16GB RAM, 512GB SSD',
      price: 1999.99,
      stock: 10,
      status: ProductStatus.ACTIVE,
      categoryId: laptops.id,
    },
  });

  const iphone = await prisma.product.upsert({
    where: { sku: 'PHN-001' },
    update: {},
    create: {
      name: 'iPhone 16 Pro',
      sku: 'PHN-001',
      description: '128GB, Titanium finish, A18 chip',
      price: 1099.99,
      stock: 25,
      status: ProductStatus.ACTIVE,
      categoryId: smartphones.id,
    },
  });

  const headphones = await prisma.product.upsert({
    where: { sku: 'HDN-001' },
    update: {},
    create: {
      name: 'Sony WH-1000XM5',
      sku: 'HDN-001',
      description: 'Wireless noise-cancelling headphones, 30h battery',
      price: 349.99,
      stock: 50,
      status: ProductStatus.ACTIVE,
      categoryId: audio.id,
    },
  });

  console.log(`📦 Products: ${macbook.name}, ${iphone.name}, ${headphones.name}`);

  // ─── Order with Items ───────────────────────────────
  const order = await prisma.order.create({
    data: {
      userId: customer.id,
      totalAmount: 2349.98,
      status: 'PAID',
      items: {
        create: [
          {
            productId: macbook.id,
            quantity: 1,
            price: 1999.99,
            subtotal: 1999.99,
          },
          {
            productId: headphones.id,
            quantity: 1,
            price: 349.99,
            subtotal: 349.99,
          },
        ],
      },
    },
  });

  console.log(`🧾 Order #${order.id.slice(0, 8)}… created with 2 items`);

  // ─── Payment ────────────────────────────────────────
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: PaymentProvider.STRIPE,
      transactionId: `pi_${crypto.randomUUID().replace(/-/g, '')}`,
      status: 'SUCCESS',
      rawResponse: {
        id: `pi_${crypto.randomUUID().replace(/-/g, '')}`,
        amount: 234998,
        currency: 'usd',
        status: 'succeeded',
        payment_method: 'pm_card_visa',
        created: Date.now(),
      },
    },
  });

  console.log(`💳 Payment ${payment.transactionId} — SUCCESS via STRIPE\n`);
  console.log('✅ Seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
