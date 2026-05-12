// Mockujemy moduły zanim zostaną załadowane przez routes
jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id', response: '250 OK' }),
}));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$hashed$'),
  compare: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const bcrypt = require('bcrypt');

const SECRET = 'SECRET_KEY';

// resetMocks zeruje implementacje przed każdym testem — przywracamy wymagane domyślne
beforeEach(() => {
  bcrypt.hash.mockResolvedValue('$hashed$');
  const mailer = require('../mailer');
  mailer.sendMail.mockResolvedValue({ messageId: 'test-id', response: '250 OK' });
});

const app = express();
app.use(express.json());
app.use(require('../routes/auth'));

// ------------------------------------------------------------------ POST /register
describe('POST /register', () => {
  it('zwraca 400 gdy brakuje emaila', async () => {
    const res = await request(app).post('/register').send({ password: 'haslo123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/wymagane/i);
  });

  it('zwraca 400 gdy brakuje hasła', async () => {
    const res = await request(app).post('/register').send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/wymagane/i);
  });

  it('zwraca 400 gdy email już istnieje', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // znaleziono istniejącego usera
    const res = await request(app)
      .post('/register')
      .send({ email: 'istniejacy@test.com', password: 'haslo' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/już istnieje/i);
  });

  it('rejestruje nowego użytkownika z rolą client i zwraca dane usera', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })  // brak konfliktu emaila
      .mockResolvedValueOnce({ rows: [{ id: 7, email: 'nowy@test.com', role: 'client' }] });

    const res = await request(app)
      .post('/register')
      .send({ email: 'nowy@test.com', password: 'haslo123' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('nowy@test.com');
    expect(res.body.role).toBe('client');
    expect(bcrypt.hash).toHaveBeenCalledWith('haslo123', 10);
  });

  it('wysyła mail powitalny po rejestracji (nie blokuje odpowiedzi)', async () => {
    const mailer = require('../mailer');
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 8, email: 'mail@test.com', role: 'client' }] });

    await request(app)
      .post('/register')
      .send({ email: 'mail@test.com', password: 'haslo123' });

    // mail jest wysyłany asynchronicznie — dajemy chwilę na wykonanie
    await new Promise((r) => setTimeout(r, 10));
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'mail@test.com' })
    );
  });
});

// ------------------------------------------------------------------ POST /login
describe('POST /login', () => {
  it('zwraca 400 gdy użytkownik nie istnieje', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/login')
      .send({ email: 'brak@test.com', password: 'haslo' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nie znaleziono/i);
  });

  it('zwraca 400 gdy hasło jest niepoprawne', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'u@test.com', password: '$hashed$', role: 'client' }],
    });
    bcrypt.compare.mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/login')
      .send({ email: 'u@test.com', password: 'zle_haslo' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nieprawidłowe hasło/i);
  });

  it('zwraca token JWT przy poprawnych danych logowania', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 3, email: 'u@test.com', password: '$hashed$', role: 'provider' }],
    });
    bcrypt.compare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/login')
      .send({ email: 'u@test.com', password: 'poprawne_haslo' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    const decoded = jwt.verify(res.body.token, SECRET);
    expect(decoded.userId).toBe(3);
    expect(decoded.role).toBe('provider');
    expect(decoded.email).toBe('u@test.com');
  });
});

// ------------------------------------------------------------------ POST /become-provider
describe('POST /become-provider', () => {
  it('zwraca 401 bez tokenu autoryzacji', async () => {
    await request(app).post('/become-provider').expect(401);
  });

  it('aktualizuje rolę na provider i zwraca nowy token', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'u@test.com', role: 'provider' }],
    });

    const clientToken = `Bearer ${jwt.sign(
      { userId: 1, role: 'client', email: 'u@test.com' },
      SECRET
    )}`;

    const res = await request(app)
      .post('/become-provider')
      .set('Authorization', clientToken);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    const decoded = jwt.verify(res.body.token, SECRET);
    expect(decoded.role).toBe('provider');
    expect(decoded.userId).toBe(1);
  });
});
