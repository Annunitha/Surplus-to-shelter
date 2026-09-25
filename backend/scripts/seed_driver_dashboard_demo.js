const { pool } = require('../db');

async function seedDriverData() {
  // Find driver
  const driverRes = await pool.query(`
    SELECT u.id as user_id, u.email, d.id as driver_id, d.name
    FROM users u
    JOIN drivers d ON d.id = u.profile_id
    WHERE u.email IN ('driver_browser@test.com', 'sharmamohit20@gmail.com', 'amit_driver@demo.com')
       OR u.role = 'driver'
  `);

  console.log('Found drivers:', driverRes.rows);

  if (driverRes.rows.length === 0) {
    console.log('No drivers found');
    await pool.end();
    return;
  }

  const donorRes = await pool.query("SELECT id, org_name, address_text FROM donors LIMIT 5");
  const recipientRes = await pool.query("SELECT id, org_name, address_text FROM recipients LIMIT 5");

  const donor1 = donorRes.rows[0];
  const donor2 = donorRes.rows[1] || donor1;
  const recipient1 = recipientRes.rows[0];
  const recipient2 = recipientRes.rows[1] || recipient1;

  for (const drv of driverRes.rows) {
    const driverId = drv.driver_id;
    console.log(`Seeding data for driver ${drv.name} (${driverId})...`);

    // 1. Active Mission (status: 'matched' or 'picked_up')
    const activeDon = await pool.query(`
      INSERT INTO donations (
        donor_id, matched_recipient_id, matched_driver_id,
        food_description, food_type, quantity, unit, weight_kg,
        pickup_address, pickup_location, expiry_window_end, status, posted_at, notes
      )
      VALUES (
        $1, $2, $3,
        'Fresh Paneer Butter Masala & Garlic Naan (45 Meals)', 'prepared_meals', 45, 'servings', 22.5,
        'Connaught Place Inner Circle, Block B, New Delhi',
        ST_SetSRID(ST_MakePoint(77.2167, 28.6315), 4326)::geography,
        now() + interval '3 hours', 'picked_up', now() - interval '25 minutes',
        'Keep insulated container sealed at >60°C until delivery.'
      )
      RETURNING id
    `, [donor1.id, recipient1.id, driverId]);

    if (activeDon.rows[0]) {
      await pool.query(`
        INSERT INTO deliveries (donation_id, driver_id, pickup_eta, dropoff_eta, actual_pickup_time)
        VALUES ($1, $2, now() - interval '15 minutes', now() + interval '10 minutes', now() - interval '12 minutes')
      `, [activeDon.rows[0].id, driverId]);
    }

    // 2. Completed Delivery 1
    const del1 = await pool.query(`
      INSERT INTO donations (
        donor_id, matched_recipient_id, matched_driver_id,
        food_description, food_type, quantity, unit, weight_kg,
        pickup_address, pickup_location, expiry_window_end, status, posted_at
      )
      VALUES (
        $1, $2, $3,
        'Chilled Dairy, Milk Packets & Organic Yogurt Tubs', 'dairy', 35, 'kg', 35.0,
        'Barakhamba Road Commercial Kitchens, New Delhi',
        ST_SetSRID(ST_MakePoint(77.2250, 28.6300), 4326)::geography,
        now() - interval '1 hour', 'delivered', now() - interval '3 hours'
      )
      RETURNING id
    `, [donor2.id, recipient2.id, driverId]);

    if (del1.rows[0]) {
      await pool.query(`
        INSERT INTO deliveries (donation_id, driver_id, pickup_eta, dropoff_eta, actual_pickup_time, actual_delivery_time)
        VALUES ($1, $2, now() - interval '2 hours 30 minutes', now() - interval '2 hours', now() - interval '2 hours 25 minutes', now() - interval '2 hours')
      `, [del1.rows[0].id, driverId]);
    }

    // 3. Completed Delivery 2
    const del2 = await pool.query(`
      INSERT INTO donations (
        donor_id, matched_recipient_id, matched_driver_id,
        food_description, food_type, quantity, unit, weight_kg,
        pickup_address, pickup_location, expiry_window_end, status, posted_at
      )
      VALUES (
        $1, $2, $3,
        'Artisan Whole Wheat Sourdough & Multigrain Loaves', 'bakery', 40, 'kg', 40.0,
        'Khan Market Bakery Hub, New Delhi',
        ST_SetSRID(ST_MakePoint(77.2270, 28.6000), 4326)::geography,
        now() - interval '4 hours', 'delivered', now() - interval '6 hours'
      )
      RETURNING id
    `, [donor1.id, recipient2.id, driverId]);

    if (del2.rows[0]) {
      await pool.query(`
        INSERT INTO deliveries (donation_id, driver_id, pickup_eta, dropoff_eta, actual_pickup_time, actual_delivery_time)
        VALUES ($1, $2, now() - interval '5 hours 30 minutes', now() - interval '5 hours', now() - interval '5 hours 20 minutes', now() - interval '5 hours')
      `, [del2.rows[0].id, driverId]);
    }

    // 4. Completed Delivery 3
    const del3 = await pool.query(`
      INSERT INTO donations (
        donor_id, matched_recipient_id, matched_driver_id,
        food_description, food_type, quantity, unit, weight_kg,
        pickup_address, pickup_location, expiry_window_end, status, posted_at
      )
      VALUES (
        $1, $2, $3,
        'Fresh Steamed Dal Makhani & Jeera Rice Platters', 'prepared_meals', 50, 'servings', 25.0,
        'Paharganj Grand Banquet, New Delhi',
        ST_SetSRID(ST_MakePoint(77.2140, 28.6390), 4326)::geography,
        now() - interval '8 hours', 'delivered', now() - interval '10 hours'
      )
      RETURNING id
    `, [donor2.id, recipient1.id, driverId]);

    if (del3.rows[0]) {
      await pool.query(`
        INSERT INTO deliveries (donation_id, driver_id, pickup_eta, dropoff_eta, actual_pickup_time, actual_delivery_time)
        VALUES ($1, $2, now() - interval '9 hours 30 minutes', now() - interval '9 hours', now() - interval '9 hours 25 minutes', now() - interval '9 hours')
      `, [del3.rows[0].id, driverId]);
    }

    // 5. Completed Delivery 4
    const del4 = await pool.query(`
      INSERT INTO donations (
        donor_id, matched_recipient_id, matched_driver_id,
        food_description, food_type, quantity, unit, weight_kg,
        pickup_address, pickup_location, expiry_window_end, status, posted_at
      )
      VALUES (
        $1, $2, $3,
        'Fresh Organic Farm Vegetable Crates (Spinach, Tomatoes)', 'produce', 20, 'kg', 20.0,
        'Karol Bagh Fresh Market Wholesale',
        ST_SetSRID(ST_MakePoint(77.1910, 28.6510), 4326)::geography,
        now() - interval '12 hours', 'delivered', now() - interval '14 hours'
      )
      RETURNING id
    `, [donor1.id, recipient1.id, driverId]);

    if (del4.rows[0]) {
      await pool.query(`
        INSERT INTO deliveries (donation_id, driver_id, pickup_eta, dropoff_eta, actual_pickup_time, actual_delivery_time)
        VALUES ($1, $2, now() - interval '13 hours 30 minutes', now() - interval '13 hours', now() - interval '13 hours 25 minutes', now() - interval '13 hours')
      `, [del4.rows[0].id, driverId]);
    }
  }

  console.log('Driver dashboard sample data successfully seeded!');
  await pool.end();
}

seedDriverData().catch(console.error);
