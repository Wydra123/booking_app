const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const SECRET = 'SECRET_KEY';
const sign = (payload) => `Bearer ${jwt.sign(payload, SECRET)}`;

// ------------------------------------------------------------------ authMiddleware
describe('authMiddleware', () => {
  const authMiddleware = require('../middleware/auth');
  const app = express();
  app.get('/protected', authMiddleware, (req, res) => res.json(req.user));

  it('zwraca 401 gdy brak nagłówka Authorization', async () => {
    await request(app).get('/protected').expect(401);
  });

  it('zwraca 403 gdy token jest nieprawidłowy', async () => {
    await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer nieprawidlowy_token')
      .expect(403);
  });

  it('przepuszcza żądanie i ustawia req.user przy poprawnym tokenie', async () => {
    const token = sign({ userId: 5, role: 'client', email: 'a@b.com' });
    const res = await request(app).get('/protected').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: 5, role: 'client', email: 'a@b.com' });
  });

  it('poprawnie parsuje token z prefiksem Bearer', async () => {
    const token = sign({ userId: 10, role: 'provider', email: 'p@b.com' });
    const res = await request(app).get('/protected').set('Authorization', token);
    expect(res.body.userId).toBe(10);
  });
});

// ------------------------------------------------------------------ adminAuth
describe('adminAuth', () => {
  const adminAuth = require('../middleware/adminAuth');
  const app = express();
  app.get('/admin', adminAuth, (req, res) => res.json(req.user));

  it('zwraca 401 gdy brak nagłówka Authorization', async () => {
    await request(app).get('/admin').expect(401);
  });

  it('zwraca 403 gdy token jest nieprawidłowy', async () => {
    await request(app)
      .get('/admin')
      .set('Authorization', 'Bearer zly_token')
      .expect(403);
  });

  it('zwraca 403 dla roli client', async () => {
    await request(app)
      .get('/admin')
      .set('Authorization', sign({ userId: 1, role: 'client', email: 'c@b.com' }))
      .expect(403);
  });

  it('zwraca 403 dla roli provider', async () => {
    await request(app)
      .get('/admin')
      .set('Authorization', sign({ userId: 2, role: 'provider', email: 'p@b.com' }))
      .expect(403);
  });

  it('przepuszcza żądanie i ustawia req.user przy tokenie admina', async () => {
    const token = sign({ userId: 99, role: 'admin', email: 'admin@b.com' });
    const res = await request(app).get('/admin').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(res.body.userId).toBe(99);
  });
});
