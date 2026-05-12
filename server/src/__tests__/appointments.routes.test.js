jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../ws', () => ({ notifyProvider: jest.fn(), init: jest.fn() }));

const request = require('supertest');
const express = require('express');
const pool = require('../db');
const wsServer = require('../ws');
const { clientToken, providerToken } = require('./helpers/tokens');

const app = express();
app.use(express.json());
app.use(require('../routes/appointments'));

// ------------------------------------------------------------------ POST /appointments
describe('POST /appointments', () => {
  const body = { service_id: 1, appointment_time: '2024-01-15T09:00' };

  it('zwraca 401 bez tokenu', async () => {
    await request(app).post('/appointments').send(body).expect(401);
  });

  it('tworzy rezerwację i zwraca ją', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, duration: 60, name: 'Fryzjer', user_id: 2 }] }) // SELECT service
      .mockResolvedValueOnce({ rows: [] })                                                       // brak konfliktu
      .mockResolvedValueOnce({
        rows: [{ id: 10, user_id: 1, service_id: 1,
                 appointment_time: '2024-01-15T09:00', end_time: '2024-01-15T10:00' }],
      })                                                                                          // INSERT appointment
      .mockResolvedValueOnce({
        rows: [{ email: 'client@test.com', first_name: 'Jan', last_name: 'Kowalski', phone: null }],
      });                                                                                         // dane klienta

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', clientToken)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(10);
    expect(res.body.appointment_time).toBe('2024-01-15T09:00');
  });

  it('oblicza end_time na podstawie czasu trwania usługi', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, duration: 90, name: 'Masaż', user_id: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 11, appointment_time: '2024-01-15T10:00', end_time: '2024-01-15T11:30' }],
      })
      .mockResolvedValueOnce({ rows: [{ email: 'c@t.com', first_name: null, last_name: null, phone: null }] });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', clientToken)
      .send({ service_id: 1, appointment_time: '2024-01-15T10:00' });

    expect(res.status).toBe(200);
    // end_time obliczone przez addMinutes: 10:00 + 90 min = 11:30
    const insertCall = pool.query.mock.calls[2];
    expect(insertCall[1][3]).toBe('2024-01-15T11:30');
  });

  it('zwraca 400 gdy termin jest już zajęty (kolizja)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, duration: 60, name: 'Fryzjer', user_id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] }); // kolizja!

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', clientToken)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Termin zajęty');
  });

  it('wysyła powiadomienie WebSocket do providera po rezerwacji', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, duration: 30, name: 'Strzyżenie', user_id: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 12, appointment_time: '2024-01-15T09:00', end_time: '2024-01-15T09:30' }] })
      .mockResolvedValueOnce({ rows: [{ email: 'c@test.com', first_name: 'Anna', last_name: 'Nowak', phone: '600700800' }] });

    await request(app)
      .post('/appointments')
      .set('Authorization', clientToken)
      .send(body);

    expect(wsServer.notifyProvider).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        type: 'new_booking',
        serviceName: 'Strzyżenie',
        clientEmail: 'c@test.com',
      })
    );
  });
});

// ------------------------------------------------------------------ DELETE /appointments/:id  (klient)
describe('DELETE /appointments/:id', () => {
  it('zwraca 401 bez tokenu', async () => {
    await request(app).delete('/appointments/1').expect(401);
  });

  it('usuwa własną rezerwację klienta', async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await request(app)
      .delete('/appointments/1')
      .set('Authorization', clientToken);
    expect(res.status).toBe(200);
    expect(res.text).toBe('Deleted');
  });

  it('delete query zawiera user_id klienta (nie można usunąć cudzej rezerwacji)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await request(app)
      .delete('/appointments/99')
      .set('Authorization', clientToken);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/user_id/i);
    expect(params).toContain(1); // userId z clientToken
  });
});

// ------------------------------------------------------------------ DELETE /provider/appointments/:id
describe('DELETE /provider/appointments/:id', () => {
  it('zwraca 401 bez tokenu', async () => {
    await request(app).delete('/provider/appointments/1').expect(401);
  });

  it('zwraca 403 gdy provider nie jest właścicielem usługi do której należy rezerwacja', async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // JOIN nie zwrócił rekordu
    const res = await request(app)
      .delete('/provider/appointments/1')
      .set('Authorization', providerToken);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/brak dostępu/i);
  });

  it('usuwa rezerwację gdy provider jest właścicielem usługi', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(app)
      .delete('/provider/appointments/1')
      .set('Authorization', providerToken);
    expect(res.status).toBe(200);
    expect(res.text).toBe('Deleted');
  });
});

// ------------------------------------------------------------------ GET /appointments/:serviceId
describe('GET /appointments/:serviceId', () => {
  it('zwraca zajęte terminy bez autoryzacji', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { appointment_time: '2024-01-15T09:00', end_time: '2024-01-15T10:00' },
        { appointment_time: '2024-01-15T11:00', end_time: '2024-01-15T12:00' },
      ],
    });
    const res = await request(app).get('/appointments/1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ------------------------------------------------------------------ GET /available-slots/:serviceId
describe('GET /available-slots/:serviceId', () => {
  it('zwraca 400 gdy brakuje parametru date', async () => {
    await request(app).get('/available-slots/1').expect(400);
  });

  it('zwraca pustą tablicę gdy provider nie pracuje w dany dzień', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ duration: 60 }] }) // service
      .mockResolvedValueOnce({ rows: [] });                 // brak availability dla tego dnia

    const res = await request(app).get('/available-slots/1?date=2024-01-15');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('generuje sloty co 30 min z flagą available i oznacza zajęte', async () => {
    // 2024-01-15 to poniedziałek: getDay()=1 → (1+6)%7 = 0 → day_of_week=0
    pool.query
      .mockResolvedValueOnce({ rows: [{ duration: 60 }] })
      .mockResolvedValueOnce({ rows: [{ start_time: '09:00:00', end_time: '11:00:00', day_of_week: 0 }] })
      .mockResolvedValueOnce({
        // slot 09:30 jest zajęty
        rows: [{ appointment_time: '2024-01-15T09:30', end_time: '2024-01-15T10:30' }],
      });

    const res = await request(app).get('/available-slots/1?date=2024-01-15');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    const slot930 = res.body.find((s) => s.time === '2024-01-15T09:30');
    expect(slot930).toBeDefined();
    expect(slot930.available).toBe(false);

    const slot900 = res.body.find((s) => s.time === '2024-01-15T09:00');
    expect(slot900).toBeDefined();
    expect(slot900.available).toBe(true);
  });
});

// ------------------------------------------------------------------ GET /my-appointments
describe('GET /my-appointments', () => {
  it('zwraca 401 bez tokenu', async () => {
    await request(app).get('/my-appointments').expect(401);
  });

  it('zwraca rezerwacje zalogowanego klienta posortowane chronologicznie', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Fryzjer', appointment_time: '2024-01-15T09:00' },
        { id: 2, name: 'Manicure', appointment_time: '2024-01-20T14:00' },
      ],
    });
    const res = await request(app)
      .get('/my-appointments')
      .set('Authorization', clientToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Fryzjer');
  });
});
