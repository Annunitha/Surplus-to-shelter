const { pool } = require('../db');
const { notifyDriverDispatched } = require('./notifications');

let ioInstance = null;

function setSocketIo(io) {
  ioInstance = io;
}

function emitEvent(eventName, payload) {
  if (ioInstance) {
    ioInstance.emit(eventName, payload);
  }
}

async function upsertDonationConnection({ donationId, donorId, recipientId, driverId = null, status = 'assigned' }) {
  if (!donationId || !donorId) return null;

  const connectionId = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO donation_connections (id, donation_id, donor_id, recipient_id, driver_id, connection_status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, datetime('now'), datetime('now'))
     ON CONFLICT(donation_id) DO UPDATE SET
       donor_id = excluded.donor_id,
       recipient_id = excluded.recipient_id,
       driver_id = excluded.driver_id,
       connection_status = excluded.connection_status,
       updated_at = datetime('now')`,
    [connectionId, donationId, donorId, recipientId || null, driverId || null, status]
  );

  return { donationId, donorId, recipientId, driverId, status };
}

/**
 * Task 1 & FR-4.1: Assign nearest available driver to a 'matched' donation.
 * If no driver is available, leave in 'matched' awaiting driver (FR-4.4).
 */
async function assignDriver(donationId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch donation
    const donRes = await client.query(
      `SELECT id, donor_id, food_description, food_type, quantity, unit, weight_kg,
              pickup_location, pickup_address, status, matched_driver_id, expiry_window_end
       FROM donations
       WHERE id = $1
      `,
      [donationId]
    );

    if (donRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { assigned: false, reason: 'donation_not_found' };
    }

    const donation = donRes.rows[0];

    const donorAndRecipient = await client.query(
      `SELECT donor_id, matched_recipient_id FROM donations WHERE id = $1`,
      [donationId]
    );

    // Only assign driver if donation is 'matched' and doesn't already have an assigned driver
    if (donation.status !== 'matched') {
      await client.query('ROLLBACK');
      return { assigned: false, reason: `status_not_matched:${donation.status}` };
    }

    if (donation.matched_driver_id) {
      await client.query('ROLLBACK');
      return { assigned: true, alreadyAssigned: true, driverId: donation.matched_driver_id };
    }

    // Find nearest available driver (straight-line PostGIS distance)
    const driverRes = await client.query(
            `SELECT d.id, d.name, d.contact_phone, u.email,
              COALESCE((SELECT AVG(f.rating) FROM feedback f WHERE f.driver_id = d.id), 0) AS average_rating,
              (ST_Distance(d.current_location, $1) / 1000.0) AS distance_km
       FROM drivers d
       LEFT JOIN users u ON u.profile_id = d.id
       WHERE d.status = 'available'
      ORDER BY average_rating DESC, ST_Distance(d.current_location, $1) ASC
       LIMIT 1
      `,
      [donation.pickup_location]
    );

    if (driverRes.rows.length === 0) {
      // FR-4.4: If no driver is available, donation remains 'matched' and displays 'awaiting driver'
      console.log(`[Dispatch] No available driver for donation ${donationId}. Leaving in 'matched' status awaiting driver.`);
      await client.query('COMMIT');
      return { assigned: false, reason: 'awaiting_driver' };
    }

    const driver = driverRes.rows[0];

    // Assign driver to donation
    await client.query(
      `UPDATE donations SET matched_driver_id = $1 WHERE id = $2`,
      [driver.id, donationId]
    );

    // Update driver status to 'en_route' (Task 1)
    await client.query(
      `UPDATE drivers SET status = 'en_route' WHERE id = $1`,
      [driver.id]
    );

    const donorInfo = donorAndRecipient.rows[0] || {};
    await upsertDonationConnection({
      donationId,
      donorId: donorInfo.donor_id || donation.donor_id,
      recipientId: donorInfo.matched_recipient_id || donation.matched_recipient_id,
      driverId: driver.id,
      status: 'assigned'
    });

    // Create deliveries row with pickup and dropoff ETAs
    const now = new Date();
    const pickupEta = new Date(now.getTime() + 15 * 60 * 1000); // +15 mins
    const dropoffEta = new Date(now.getTime() + 45 * 60 * 1000); // +45 mins

    const deliveryRes = await client.query(
      `INSERT INTO deliveries (donation_id, driver_id, pickup_eta, dropoff_eta)
       VALUES ($1, $2, $3, $4)
       RETURNING id, pickup_eta, dropoff_eta`,
      [donationId, driver.id, pickupEta.toISOString(), dropoffEta.toISOString()]
    );

    await client.query('COMMIT');

    console.log(`[Dispatch] Assigned driver ${driver.name} (${driver.id}) rating ${Number(driver.average_rating).toFixed(2)} (${driver.distance_km ? driver.distance_km.toFixed(2) : '?'} km away)`);

    // Emit WebSocket "assignment:new" per ARCHITECTURE.md §6
    emitEvent('assignment:new', {
      donationId,
      driverId: driver.id,
      pickup_eta: pickupEta.toISOString(),
      dropoff_eta: dropoffEta.toISOString()
    });

    // Notify driver (FR-7.2)
    notifyDriverDispatched(driver, donation).catch(err => {
      console.error('[Dispatch] Notification error:', err.message);
    });

    return {
      assigned: true,
      driver: { id: driver.id, name: driver.name, average_rating: Number(driver.average_rating) || 0, distance_km: driver.distance_km },
      delivery: deliveryRes.rows[0]
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Dispatch] assignDriver error:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Checks for any 'matched' donations awaiting driver and attempts dispatch.
 * Called when a driver becomes available.
 */
async function checkAwaitingDriverDonations() {
  try {
    const res = await pool.query(
      `SELECT id FROM donations
       WHERE status = 'matched' AND matched_driver_id IS NULL
       ORDER BY posted_at ASC`
    );

    for (const row of res.rows) {
      const result = await assignDriver(row.id);
      if (result.assigned) {
        console.log(`[Dispatch] Successfully assigned awaiting donation ${row.id}`);
      }
    }
  } catch (err) {
    console.error('[Dispatch] checkAwaitingDriverDonations error:', err.message);
  }
}

/**
 * Task 5 & ARCHITECTURE.md §7:
 * Records impact log when a delivery is completed.
 *   MEALS_PER_KG = 1 / 0.545 (~1.83486 meals per kg)
 *   CO2E_KG_PER_KG_FOOD = 2.5 (EPA WARM model factor)
 */
async function recordImpact(donationId, dbClient = pool) {
  // Fetch donation details
  const res = await dbClient.query(
    `SELECT id, weight_kg, quantity FROM donations WHERE id = $1`,
    [donationId]
  );

  if (res.rows.length === 0) return null;

  const donation = res.rows[0];
  const weightKg = parseFloat(donation.weight_kg) || parseFloat(donation.quantity) || 1.0;

  const mealsEstimate = weightKg / 0.545;
  const co2eAvoidedKg = weightKg * 2.5;

  const insertRes = await dbClient.query(
    `INSERT INTO impact_log (donation_id, weight_kg, meals_estimate, co2e_avoided_kg)
     VALUES ($1, $2, $3, $4)
     RETURNING id, weight_kg, meals_estimate, co2e_avoided_kg, logged_at`,
    [donationId, weightKg, mealsEstimate, co2eAvoidedKg]
  );

  console.log(`[Impact] Logged delivery impact for donation ${donationId}: ${weightKg.toFixed(2)} kg, ~${mealsEstimate.toFixed(1)} meals, ~${co2eAvoidedKg.toFixed(2)} kg CO2e avoided`);

  return insertRes.rows[0];
}

module.exports = {
  assignDriver,
  checkAwaitingDriverDonations,
  recordImpact,
  setSocketIo
};
