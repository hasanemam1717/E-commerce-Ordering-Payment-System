import request from 'supertest';
import { app } from '../../app';
import { resetTestState } from '../helpers/setup';
import { prisma } from '../../config/prisma';

describe('Category tree integration', () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it('GET /api/categories/:id/tree returns a nested DFS tree structure', async () => {
    const root = await prisma.category.create({
      data: {
        name: 'Electronics',
        slug: 'electronics',
      },
    });

    const child = await prisma.category.create({
      data: {
        name: 'Laptops',
        slug: 'laptops',
        parentId: root.id,
      },
    });

    await prisma.product.createMany({
      data: [
        {
          name: 'MacBook',
          sku: 'MB-001',
          price: 1999.99,
          stock: 3,
          status: 'ACTIVE',
          categoryId: root.id,
        },
        {
          name: 'ThinkPad',
          sku: 'TP-001',
          price: 999.99,
          stock: 5,
          status: 'ACTIVE',
          categoryId: child.id,
        },
      ],
    });

    const response = await request(app).get(`/api/categories/${root.id}/tree`).expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        category: expect.objectContaining({
          id: root.id,
          name: 'Electronics',
          slug: 'electronics',
          children: expect.arrayContaining([
            expect.objectContaining({
              id: child.id,
              name: 'Laptops',
              slug: 'laptops',
            }),
          ]),
        }),
        totalProducts: 2,
        depth: 1,
      }),
    );

    expect(response.body.category.products).toEqual(
      expect.arrayContaining([expect.objectContaining({ sku: 'MB-001' })]),
    );
    expect(response.body.category.children[0]?.products).toEqual(
      expect.arrayContaining([expect.objectContaining({ sku: 'TP-001' })]),
    );
  });
});
