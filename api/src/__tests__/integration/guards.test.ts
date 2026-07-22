import request from 'supertest';
import { app } from '../../app';
import { resetTestState } from '../helpers/setup';
import { createAuthToken, registerTestUser } from '../helpers/auth.helper';
import { prisma } from '../../config/prisma';

describe('Auth and guard integration', () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it('POST /api/orders with valid Bearer token creates an order', async () => {
    const customer = await registerTestUser({ role: 'CUSTOMER' });
    const category = await prisma.category.create({
      data: { name: 'Test Category', slug: 'test-category' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        sku: 'TEST-001',
        price: 99.99,
        stock: 5,
        status: 'ACTIVE',
        categoryId: category.id,
      },
    });

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        userId: customer.user.id,
        status: 'PENDING',
        total: 99.99,
      }),
    );
    expect(response.body.items).toHaveLength(1);
  });

  it('POST /api/orders without Bearer token is rejected', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({
        items: [],
      })
      .expect(401);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'error',
        message: expect.stringMatching(/Authorization|Authentication/i),
      }),
    );
  });

  it('POST /api/products as CUSTOMER is forbidden', async () => {
    const customerToken = await createAuthToken({ role: 'CUSTOMER' });

    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Customer Product',
        sku: 'CUST-001',
        price: 19.99,
        stock: 2,
      })
      .expect(403);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'Admin access required',
      }),
    );
  });
});
