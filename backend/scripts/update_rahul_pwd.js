const bcrypt = require('bcryptjs');
const { pool } = require('../db');

async function main() {
  const hash = await bcrypt.hash('demo1234', 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'driver_browser@test.com']);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'shelter_browser@test.com']);
  console.log('Updated driver_browser@test.com and shelter_browser@test.com password to demo1234');
  await pool.end();
}

main().catch(console.error);
