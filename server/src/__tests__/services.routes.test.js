jest.mock('../db', () => ({ query: jest.fn() }));

const request = require('supertest');
const express = require('express');
const pool = require('../db');
const { clientToken, providerToken, adminToken } = require('./helpers/tokens');

const app = express();
app.use(express.json());
app.use(require('../routes/services'));

// ------------------------------------------------------------------ GET /services
describe('GET /services', () => {
  it('zwraca listę usług bez autoryzacji', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Fryzjer', price: '50', duration: 60 },
        { id: 2, name: 'Manicure', price: '80', duration: 45 },
      ],
    });
    const res = await request(app).get('/services');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Fryzjer');
  });
});

// ------------------------------------------------------------------ POST /services
describe('POST /services', () => {
  const payload = {
    name: 'Masaż',
    duration: 60,
    price: 120,
    availability: [{ day: 1, enabled: true, start: '09:00', end: '17:00' }],
  };

  it('zwraca 401 bez tokenu', async () => {
    await request(app).post('/services').send(payload).expect(401);
  });

  it('zwraca 403 gdy rola to client', async () => {
    const res = await request(app)
      .post('/services')
      .set('Authorization', clientToken)
      .send(payload);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only providers/i);
  });

  it('tworzy usługę dla providera i zapisuje dostępność', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Masaż', duration: 60, price: 120, user_id: 2 }] })
      .mockResolvedValueOnce({ rows: [] }); // insert availability

    const res = await request(app)
      .post('/services')
      .set('Authorization', providerToken)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Masaż');
    expect(res.body.id).toBe(5);
    // availability insert powinien być wywołany dla enabled day
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('pomija dni z enabled: false przy zapisie dostępności', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 6, name: 'Test', duration: 30, user_id: 2 }],
    });

    const bodyAllDisabled = {
      ...payload,
      availability: [
        { day: 0, enabled: false, start: '09:00', end: '17:00' },
        { day: 1, enabled: false, start: '09:00', end: '17:00' },
      ],
    };

    await request(app)
      .post('/services')
      .set('Authorization', providerToken)
      .send(bodyAllDisabled);

    // tylko 1 query (insert service) — brak insertów availability
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

// ------------------------------------------------------------------ GET /services/:id
describe('GET /services/:id', () => {
  it('zwraca 404 gdy usługa nie istnieje', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/services/999').expect(404);
  });

  it('zwraca szczegóły usługi z danymi providera', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Fryzjer', email: 'p@test.com', first_name: 'Jan', price: '50' }],
    });
    const res = await request(app).get('/services/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Fryzjer');
    expect(res.body.email).toBe('p@test.com');
  });
});

// ------------------------------------------------------------------ PUT /services/:id
describe('PUT /services/:id', () => {
  const updatePayload = {
    name: 'Fryzjer Premium',
    duration: 90,
    price: 150,
    availability: [],
  };

  it('zwraca 401 bez tokenu', async () => {
    await request(app).put('/services/1').send(updatePayload).expect(401);
  });

  it('zwraca 403 gdy user nie jest właścicielem usługi', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // brak rekordu → nie właściciel
    const res = await request(app)
      .put('/services/1')
      .set('Authorization', providerToken)
      .send(updatePayload);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/uprawnie/i);
  });

  it('aktualizuje usługę gdy user jest właścicielem', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })                                   // ownership check
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Fryzjer Premium', price: 150 }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] });                                             // DELETE availability

    const res = await request(app)
      .put('/services/1')
      .set('Authorization', providerToken)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Fryzjer Premium');
  });
});

// ------------------------------------------------------------------ DELETE /services/:id
describe('DELETE /services/:id', () => {
  it('zwraca 401 bez tokenu', async () => {
    await request(app).delete('/services/1').expect(401);
  });

  it('usuwa usługę (warunek user_id chroni przed usunięciem cudzej)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await request(app)
      .delete('/services/1')
      .set('Authorization', providerToken);
    expect(res.status).toBe(200);
    expect(res.text).toBe('Deleted');
  });
});

// ------------------------------------------------------------------ GET /my-services
describe('GET /my-services', () => {
  it('zwraca 401 bez tokenu', async () => {
    await request(app).get('/my-services').expect(401);
  });

  it('zwraca usługi należące do zalogowanego providera', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: 2 }, { id: 3, user_id: 2 }],
    });
    const res = await request(app)
      .get('/my-services')
      .set('Authorization', providerToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ------------------------------------------------------------------ GET /services/:id/bookings
describe('GET /services/:id/bookings', () => {
  it('zwraca 401 bez tokenu', async () => {
    await request(app).get('/services/1/bookings').expect(401);
  });

  it('zwraca 403 gdy user nie jest właścicielem usługi', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // ownership check fails
    const res = await request(app)
      .get('/services/1/bookings')
      .set('Authorization', clientToken);
    expect(res.status).toBe(403);
  });

  it('zwraca listę rezerwacji dla właściciela usługi', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // ownership check
      .mockResolvedValueOnce({
        rows: [
          { id: 10, appointment_time: '2024-01-15T09:00', email: 'c@test.com' },
          { id: 11, appointment_time: '2024-01-15T10:00', email: 'd@test.com' },
        ],
      });

    const res = await request(app)
      .get('/services/1/bookings')
      .set('Authorization', providerToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].email).toBe('c@test.com');
  });
});

// ------------------------------------------------------------------ GET /services/:id/availability
describe('GET /services/:id/availability', () => {
  it('zwraca okna dostępności dla danej usługi (publiczny endpoint)', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, service_id: 1, day_of_week: 1, start_time: '09:00', end_time: '17:00' }],
    });
    const res = await request(app).get('/services/1/availability');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].day_of_week).toBe(1);
  });
});
