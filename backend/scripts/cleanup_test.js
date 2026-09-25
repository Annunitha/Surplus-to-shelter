require('dotenv').config();
const { pool } = require('../db');

async function cleanup() {
  const r1 = await pool.query("DELETE FROM users WHERE email LIKE 'test%'");
  console.log('Cleaned', r1.rowCount, 'test users');
  const r2 = await pool.query("DELETE FROM donors WHERE contact_email LIKE 'test%'");
  console.log('Cleaned', r2.rowCount, 'test donors');
  const r3 = await pool.query("DELETE FROM recipients WHERE contact_email LIKE 'test%'");
  console.log('Cleaned', r3.rowCount, 'test recipients');
  const r4 = await pool.query("DELETE FROM drivers WHERE name = 'Test Driver'");
  console.log('Cleaned', r4.rowCount, 'test drivers');
  await pool.end();
}

cleanup();
