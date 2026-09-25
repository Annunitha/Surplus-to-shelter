const bcrypt = require('bcryptjs');
const { pool } = require('../db');

async function main() {
  const hash = await bcrypt.hash('demo1234', 10);
  const emails = [
    'paharganj_kitchen@demo.com',
    'karolbagh_shelter@demo.com',
    'hope@shelter.org',
    'shelter2@foodrescue.org',
    'shelter_browser@test.com',
    'driver_222er@test.com',
    'sharmamohit114@gmail.com',
    'grand_bistro@demo.com',
    'browserdonor@test.com',
    'amit_driver@demo.com',
    'driver_browser@test.com'
  ];
  for (const email of emails) {
    await pool.query('UPDATE users SET password_hash = $1 WHERE lower(email) = lower($2)', [hash, email]);
  }
  console.log('Updated passwords to demo1234 for test accounts');
  await pool.end();
}

main().catch(console.error);
