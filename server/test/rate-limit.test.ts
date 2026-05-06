import assert from 'node:assert/strict';
import test from 'node:test';
import supertest from 'supertest';

process.env.NODE_ENV = 'test';
process.env.ADMIN_CODE = 'test-admin';
process.env.COOKIE_SECRET = 'test-cookie-secret';

const { createApp } = await import('../src/index.js');

test('health checks stay available while the general API limiter applies to other routes', async () => {
  const app = createApp({
    rateLimit: {
      apiWindowMs: 60_000,
      apiMax: 2,
      authWindowMs: 60_000,
      authMax: 10,
    },
  });
  const request = supertest(app);

  await request.get('/api/health').expect(200);
  await request.get('/api/health').expect(200);
  await request.get('/api/health').expect(200);

  await request.get('/api/me').expect(200);
  await request.get('/api/me').expect(200);
  await request
    .get('/api/me')
    .expect(429)
    .expect(({ body }) => {
      assert.equal(body.error, 'too many requests, please try again later');
    });
});

test('login endpoints use a stricter limiter and ignore successful sign-ins', async () => {
  const app = createApp({
    rateLimit: {
      apiWindowMs: 60_000,
      apiMax: 100,
      authWindowMs: 60_000,
      authMax: 2,
    },
  });
  const request = supertest(app);

  await request.post('/api/admin/login').send({ adminCode: 'test-admin' }).expect(200);
  await request.post('/api/admin/login').send({ adminCode: 'test-admin' }).expect(200);
  await request.post('/api/admin/login').send({ adminCode: 'test-admin' }).expect(200);

  await request
    .post('/api/admin/login')
    .send({ adminCode: 'wrong-admin' })
    .expect(401);
  await request
    .post('/api/admin/login')
    .send({ adminCode: 'wrong-admin' })
    .expect(401);
  await request
    .post('/api/admin/login')
    .send({ adminCode: 'wrong-admin' })
    .expect(429)
    .expect(({ body }) => {
      assert.equal(body.error, 'too many requests, please try again later');
    });
});

test('login endpoints are excluded from the general api limiter even with query strings', async () => {
  const app = createApp({
    rateLimit: {
      apiWindowMs: 60_000,
      apiMax: 1,
      authWindowMs: 60_000,
      authMax: 2,
    },
  });
  const request = supertest(app);

  await request.get('/api/me').expect(200);
  await request.get('/api/me').expect(429);

  await request.post('/api/admin/login?x=1').send({ adminCode: 'test-admin' }).expect(200);
  await request
    .post('/api/admin/login?x=1')
    .send({ adminCode: 'wrong-admin' })
    .expect(401);
});
