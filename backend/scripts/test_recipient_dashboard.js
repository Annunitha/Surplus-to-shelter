const { pool } = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

async function test() {
  const userRes = await pool.query("SELECT u.id, u.email, u.role, u.profile_id FROM users u WHERE u.email = 'paharganj_kitchen@demo.com'");
  const user = userRes.rows[0];
  console.log('User:', user);

  const token = jwt.sign(
    { userId: user.profile_id, role: user.role, profileId: user.profile_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const res = await fetch('http://localhost:3000/api/recipients/me/dashboard', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Dashboard response:', JSON.stringify(data, null, 2));

  await pool.end();
}

test().catch(console.error);
