const { pool } = require('../db');

async function seedData() {
  const recipientRes = await pool.query("SELECT id, org_name FROM recipients WHERE org_name = 'Pahar Ganj Community Kitchen'");
  if (recipientRes.rows.length === 0) {
    console.log('Pahar Ganj not found');
    await pool.end();
    return;
  }
  const recId = recipientRes.rows[0].id;
  console.log('Pahar Ganj ID:', recId);

  // Check donations for this recipient
  const donRes = await pool.query("SELECT id, status FROM donations WHERE matched_recipient_id = $1", [recId]);
  console.log('Existing donations for Pahar Ganj:', donRes.rows);

  // Let's ensure Pahar Ganj has sample active offer, accepted, incoming, and delivered donations so the dashboard has rich data!
  const donorRes = await pool.query("SELECT id FROM donors LIMIT 1");
  const driverRes = await pool.query("SELECT id FROM drivers LIMIT 1");

  const donorId = donorRes.rows[0]?.id;
  const driverId = driverRes.rows[0]?.id;

  if (donorId) {
    // 1. Available offer (posted & matched to this recipient)
    await pool.query(`
      INSERT INTO donations (donor_id, matched_recipient_id, food_description, food_type, quantity, unit, weight_kg, pickup_address, pickup_location, expiry_window_end, status, posted_at)
      VALUES ($1, $2, 'Fresh Biryani & Naan Platters (30 Meals)', 'prepared_meals', 30, 'servings', 18.5, 'Connaught Place, New Delhi', ST_SetSRID(ST_MakePoint(77.2167, 28.6315), 4326)::geography, now() + interval '4 hours', 'posted', now() - interval '10 minutes')
    `, [donorId, recId]);

    // 2. Accepted donation (status matched)
    await pool.query(`
      INSERT INTO donations (donor_id, matched_recipient_id, matched_driver_id, food_description, food_type, quantity, unit, weight_kg, pickup_address, pickup_location, expiry_window_end, status, posted_at)
      VALUES ($1, $2, $3, 'Chilled Dairy, Paneer & Milk Tubs', 'dairy', 25, 'kg', 25.0, 'Barakhamba Road, New Delhi', ST_SetSRID(ST_MakePoint(77.2250, 28.6300), 4326)::geography, now() + interval '6 hours', 'matched', now() - interval '30 minutes')
    `, [donorId, recId, driverId]);

    // 3. Incoming delivery (status picked_up)
    const incomingDon = await pool.query(`
      INSERT INTO donations (donor_id, matched_recipient_id, matched_driver_id, food_description, food_type, quantity, unit, weight_kg, pickup_address, pickup_location, expiry_window_end, status, posted_at)
      VALUES ($1, $2, $3, 'Fresh Artisan Bakery & Bread Crates', 'bakery', 40, 'kg', 15.0, 'Karol Bagh Market, New Delhi', ST_SetSRID(ST_MakePoint(77.1910, 28.6510), 4326)::geography, now() + interval '5 hours', 'picked_up', now() - interval '45 minutes')
      RETURNING id
    `, [donorId, recId, driverId]);

    if (incomingDon.rows[0]) {
      await pool.query(`
        INSERT INTO deliveries (donation_id, driver_id, pickup_eta, dropoff_eta)
        VALUES ($1, $2, now() - interval '15 minutes', now() + interval '12 minutes')
      `, [incomingDon.rows[0].id, driverId]);
    }

    // 4. Delivered today
    const delDon = await pool.query(`
      INSERT INTO donations (donor_id, matched_recipient_id, matched_driver_id, food_description, food_type, quantity, unit, weight_kg, pickup_address, pickup_location, expiry_window_end, status, posted_at)
      VALUES ($1, $2, $3, 'Organic Steamed Rice & Dal Makhani Trays', 'prepared_meals', 50, 'servings', 28.0, 'Pahar Ganj Eateries Hub', ST_SetSRID(ST_MakePoint(77.2140, 28.6390), 4326)::geography, now() + interval '2 hours', 'delivered', now() - interval '2 hours')
      RETURNING id
    `, [donorId, recId, driverId]);

    if (delDon.rows[0]) {
      await pool.query(`
        INSERT INTO deliveries (donation_id, driver_id, pickup_eta, dropoff_eta, actual_delivery_time)
        VALUES ($1, $2, now() - interval '1 hour', now() - interval '30 minutes', now() - interval '25 minutes')
      `, [delDon.rows[0].id, driverId]);
    }

    console.log('Seeded sample active donations for Pahar Ganj Community Kitchen');
  }

  await pool.end();
}

seedData().catch(console.error);
