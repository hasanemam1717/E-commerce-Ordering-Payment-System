import request from 'supertest';
import { app } from '../../app';
import { resetTestState } from '../helpers/setup';

describe('Auth integration', () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it('POST /api/auth/register returns 201 with JWT and sanitized user', async () => {
    const payload = {
      email: 'new-user@example.com',
      password: 'StrongPass123!',
    };

    const response = await request(app).post('/api/auth/register').send(payload).expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({
          id: expect.any(String),
          email: payload.email,
          role: 'CUSTOMER',
        }),
      }),
    );

    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('POST /api/auth/login returns 200 with JWT for valid credentials', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'login-user@example.com',
        password: 'StrongPass123!',
      })
      .expect(201);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login-user@example.com',
        password: 'StrongPass123!',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({
          email: 'login-user@example.com',
          role: 'CUSTOMER',
        }),
      }),
    );
  });
});
