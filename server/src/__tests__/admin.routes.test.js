jest.mock('../db', () => ({ query: jest.fn() }));

const request = require('supertest');
const express = require('express');
const pool = require('../db');
const { clientToken, providerToken, adminToken } = require('./helpers/tokens');

const app = express();
app.use(express.json());
app.use(require('../routes/admin'));

// ------------------------------------------------------------------ Ochrona dostępu (każdy endpoint)
describe('Blokowanie dostępu do endpointów admina', () => {
  const publicRoutes = [
    ['get',    '/admin/stats'],
    ['get',    '/admin/users'],
    ['get',    '/admin/services'],
    ['get',    '/admin/appointments'],
  ];

  publicRoutes.forEach(([method, path]) => {
    it(`${method.toUpperCase()} ${path} → 401 bez tokenu`, async () => {
      await request(app)[method](path).expect(401);
    });

    it(`${method.toUpperCase()} ${path} → 403 dla roli client`, async () => {
      await request(app)[method](path).set('Authorization', clientToken).expect(403);
    });

    it(`${method.toUpperCase()} ${path} → 403 dla roli provider`, async () => {
      await request(app)[method](path).set('Authorization', providerToken).expect(403);
    });
  });
});

// ------------------------------------------------------------------ GET /admin/stats
describe('GET /admin/stats', () => {
  it('zwraca zagregowane liczby użytkowników, usług i rezerwacji', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '12' }] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ count: '30' }] });

    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: 12, services: 5, appointments: 30 });
  });

  it('zwraca liczby jako integer (parseInt na count z bazy)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '7' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', adminToken);

    expect(typeof res.body.users).toBe('number');
    expect(typeof res.body.services).toBe('number');
    expect(typeof res.body.appointments).toBe('number');
  });
});

// ------------------------------------------------------------------ GET /admin/users
describe('GET /admin/users', () => {
  it('zwraca listę wszystkich użytkowników z profilem', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, email: 'klient@test.com', role: 'client', first_name: 'Jan', last_name: 'Kowalski' },
        { id: 2, email: 'provider@test.com', role: 'provider', first_name: null, last_name: null },
      ],
    });

    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].role).toBe('client');
  });
});

// ------------------------------------------------------------------ PATCH /admin/users/:id/role
describe('PATCH /admin/users/:id/role', () => {
  it('zwraca 400 przy nieprawidłowej roli', async () => {
    const res = await request(app)
      .patch('/admin/users/5/role')
      .set('Authorization', adminToken)
      .send({ role: 'superadmin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Nieprawidłowa rola/i);
  });

  it('zwraca 400 gdy admin próbuje zmienić własną rolę', async () => {
    // adminToken ma userId: 99
    const res = await request(app)
      .patch('/admin/users/99/role')
      .set('Authorization', adminToken)
      .send({ role: 'client' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/własn/i);
  });

  it('zmienia rolę użytkownika i zwraca zaktualizowany rekord', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 5, email: 'u@test.com', role: 'provider' }],
    });

    const res = await request(app)
      .patch('/admin/users/5/role')
      .set('Authorization', adminToken)
      .send({ role: 'provider' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('provider');
    expect(res.body.id).toBe(5);
  });

  it('zwraca 404 gdy użytkownik nie istnieje', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/admin/users/999/role')
      .set('Authorization', adminToken)
      .send({ role: 'client' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/nie znaleziono/i);
  });

  it('przyjmuje każdą z dopuszczalnych ról: client, provider, admin', async () => {
    for (const role of ['client', 'provider', 'admin']) {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 5, email: 'u@test.com', role }] });

      const res = await request(app)
        .patch('/admin/users/5/role')
        .set('Authorization', adminToken)
        .send({ role });

      expect(res.status).toBe(200);
    }
  });
});

// ------------------------------------------------------------------ DELETE /admin/users/:id
describe('DELETE /admin/users/:id', () => {
  it('zwraca 400 gdy admin próbuje usunąć własne konto', async () => {
    // adminToken ma userId: 99
    const res = await request(app)
      .delete('/admin/users/99')
      .set('Authorization', adminToken);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/własn/i);
  });

  it('usuwa użytkownika i zwraca { ok: true }', async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .delete('/admin/users/5')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ------------------------------------------------------------------ GET /admin/services
describe('GET /admin/services', () => {
  it('zwraca wszystkie usługi z danymi właściciela', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Fryzjer', price: 50, duration: 60, owner_email: 'p@test.com', owner_id: 2 },
        { id: 2, name: 'Masaż',   price: 120, duration: 90, owner_email: 'q@test.com', owner_id: 3 },
      ],
    });

    const res = await request(app)
      .get('/admin/services')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].owner_email).toBe('p@test.com');
  });
});

// ------------------------------------------------------------------ DELETE /admin/services/:id
describe('DELETE /admin/services/:id', () => {
  it('usuwa usługę i zwraca { ok: true }', async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .delete('/admin/services/1')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ------------------------------------------------------------------ GET /admin/appointments
describe('GET /admin/appointments', () => {
  it('zwraca wszystkie rezerwacje z detalami usługi i klienta', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, appointment_time: '2024-01-15T09:00', service_name: 'Fryzjer', client_email: 'c@test.com' },
      ],
    });

    const res = await request(app)
      .get('/admin/appointments')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].service_name).toBe('Fryzjer');
    expect(res.body[0].client_email).toBe('c@test.com');
  });
});

// ------------------------------------------------------------------ DELETE /admin/appointments/:id
describe('DELETE /admin/appointments/:id', () => {
  it('usuwa rezerwację i zwraca { ok: true }', async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .delete('/admin/appointments/1')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
