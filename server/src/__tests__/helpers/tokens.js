const jwt = require('jsonwebtoken');

const SECRET = 'SECRET_KEY';
const bearer = (payload) => `Bearer ${jwt.sign(payload, SECRET)}`;

module.exports = {
  clientToken:   bearer({ userId: 1,  role: 'client',   email: 'client@test.com' }),
  providerToken: bearer({ userId: 2,  role: 'provider', email: 'provider@test.com' }),
  adminToken:    bearer({ userId: 99, role: 'admin',     email: 'admin@test.com' }),
};
