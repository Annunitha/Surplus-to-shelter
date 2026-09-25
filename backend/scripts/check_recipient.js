const { pool } = require('../db');

async function test() {
  const users = await pool.query(`
    SELECT u.id as user_id, u.email, u.profile_id, r.id as recipient_id, r.org_name, r.capacity_current, r.capacity_max
    FROM users u
    JOIN recipients r ON r.id = u.profile_id
  `);
  console.log('All recipients in DB:', users.rows);

  const donations = await pool.query(`
    SELECT id, food_description, status, matched_recipient_id, posted_at, donor_id
    FROM donations
  `);
  console.log('All donations in DB:', donations.rows);

  await pool.end();
}

test().catch(console.error);
