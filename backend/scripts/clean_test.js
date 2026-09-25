const { pool } = require('../db');

async function main() {
  await pool.query("DELETE FROM deliveries WHERE donation_id = '16b015d6-47f4-4a09-b5bd-101059bad123'");
  await pool.query("DELETE FROM donations WHERE id = '16b015d6-47f4-4a09-b5bd-101059bad123'");
  console.log('Cleaned up previous test donation');
  await pool.end();
}

main().catch(console.error);
