const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { recordImpact, checkAwaitingDriverDonations } = require('../services/dispatch');

const router = express.Router();

/**
 * GET /api/drivers/me
 * Returns current driver profile and status
 */
router.get('/me', authenticateToken, requireRole('driver'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, contact_phone, status, city_id,
              ST_Y(current_location::geometry) AS lat,
              ST_X(current_location::geometry) AS lng,
              (SELECT AVG(rating) FROM feedback WHERE driver_id = drivers.id) AS average_rating,
              (SELECT COUNT(*) FROM feedback WHERE driver_id = drivers.id) AS rating_count
       FROM drivers
       WHERE id = $1`,
      [req.user.profileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const d = result.rows[0];
    res.json({
      driver: {
        id: d.id,
        name: d.name,
        contact_phone: d.contact_phone,
        status: d.status,
        city_id: d.city_id,
        lat: d.lat ? parseFloat(d.lat) : null,
        lng: d.lng ? parseFloat(d.lng) : null,
        average_rating: d.average_rating ? parseFloat(Number(d.average_rating).toFixed(2)) : null,
        rating_count: Number(d.rating_count) || 0
      }
    });
  } catch (err) {
    console.error('Fetch driver profile error:', err);
    res.status(500).json({ error: 'Failed to fetch driver profile', details: err.message });
  }
});

/**
 * PATCH /api/drivers/me/status
 * Driver can update their availability status (available / busy)
 */
router.patch('/me/status', authenticateToken, requireRole('driver'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['available', 'busy'].includes(status)) {
      return res.status(400).json({ error: 'Status must be available or busy' });
    }

    const result = await pool.query(
      `UPDATE drivers SET status = $1 WHERE id = $2 RETURNING id, name, status`,
      [status, req.user.profileId]
    );

    if (status === 'available') {
      // Check if any donations are awaiting a driver
      try {
        await checkAwaitingDriverDonations();
      } catch (dErr) {
        console.error('Error dispatching awaiting donations:', dErr);
      }
    }

    res.json({ message: 'Status updated', driver: result.rows[0] });
  } catch (err) {
    console.error('Update driver status error:', err);
    res.status(500).json({ error: 'Failed to update status', details: err.message });
  }
});

/**
 * PATCH /api/drivers/me
 * Driver can update their profile (name, contact_phone, city_id, status)
 */
router.patch('/me', authenticateToken, requireRole('driver'), async (req, res) => {
  try {
    const { name, contact_phone, city_id, status, lat, lng } = req.body;
    const driverId = req.user.profileId;

    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name must be a non-empty string' });
      }
      updates.push(`name = $${idx++}`);
      values.push(name.trim());
    }

    if (contact_phone !== undefined) {
      updates.push(`contact_phone = $${idx++}`);
      values.push(contact_phone ? contact_phone.trim() : null);
    }

    if (city_id !== undefined) {
      updates.push(`city_id = $${idx++}`);
      values.push(city_id ? city_id.trim() : null);
    }

    if (status !== undefined) {
      if (!['available', 'busy'].includes(status)) {
        return res.status(400).json({ error: 'Status must be available or busy' });
      }
      updates.push(`status = $${idx++}`);
      values.push(status);
    }

    if (lat !== undefined || lng !== undefined) {
      const parsedLat = Number(lat);
      const parsedLng = Number(lng);
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
        return res.status(400).json({ error: 'Valid latitude and longitude are required together' });
      }
      updates.push(`current_location = ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)::geography`);
      values.push(parsedLng, parsedLat);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    values.push(driverId);
    const query = `
      UPDATE drivers
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, contact_phone, status, city_id,
                ST_Y(current_location::geometry) AS lat,
                ST_X(current_location::geometry) AS lng
    `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const d = result.rows[0];

    if (status === 'available') {
      try {
        await checkAwaitingDriverDonations();
      } catch (dErr) {
        console.error('Error dispatching awaiting donations:', dErr);
      }
    }

    res.json({
      message: 'Profile updated successfully',
      driver: {
        id: d.id,
        name: d.name,
        contact_phone: d.contact_phone,
        status: d.status,
        city_id: d.city_id,
        lat: d.lat ? parseFloat(d.lat) : null,
        lng: d.lng ? parseFloat(d.lng) : null
      }
    });
  } catch (err) {
    console.error('Update driver profile error:', err);
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

/**
 * GET /api/drivers/me/assignment
 * Task 3 & ARCHITECTURE.md §5:
 * Returns current assigned donation with donor location, recipient location,
 * food description, and expiry countdown.
 */
router.get('/me/assignment', authenticateToken, requireRole('driver'), async (req, res) => {
  try {
    const driverId = req.user.profileId;

    const query = `
      SELECT d.id AS donation_id, d.food_description, d.food_type, d.quantity, d.unit, d.weight_kg,
             d.pickup_address, d.posted_at, d.expiry_window_end, d.status AS donation_status,
             ST_Y(d.pickup_location::geometry) AS pickup_lat,
             ST_X(d.pickup_location::geometry) AS pickup_lng,
             dn.org_name AS donor_org_name, dn.contact_phone AS donor_phone, dn.contact_email AS donor_email,
             r.org_name AS recipient_org_name, r.address_text AS recipient_address,
             r.contact_phone AS recipient_phone, r.contact_email AS recipient_email,
             ST_Y(r.location::geometry) AS dropoff_lat,
             ST_X(r.location::geometry) AS dropoff_lng,
             del.id AS delivery_id, del.pickup_eta, del.dropoff_eta,
             del.actual_pickup_time, del.actual_delivery_time
      FROM donations d
      JOIN donors dn ON dn.id = d.donor_id
      LEFT JOIN recipients r ON r.id = d.matched_recipient_id
      LEFT JOIN deliveries del ON del.donation_id = d.id AND del.driver_id = $1
      WHERE d.matched_driver_id = $1
        AND d.status IN ('matched', 'picked_up')
      ORDER BY d.posted_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [driverId]);

    if (result.rows.length === 0) {
      return res.json({ assignment: null });
    }

    const row = result.rows[0];
    const now = new Date();
    const expiryDate = new Date(row.expiry_window_end);
    const expiresInSeconds = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000));

    res.json({
      assignment: {
        donation_id: row.donation_id,
        food_description: row.food_description,
        food_type: row.food_type,
        quantity: parseFloat(row.quantity),
        unit: row.unit,
        weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : null,
        status: row.donation_status,
        expiry_window_end: row.expiry_window_end,
        expires_in_seconds: expiresInSeconds,
        posted_at: row.posted_at,
        pickup: {
          org_name: row.donor_org_name,
          address: row.pickup_address,
          phone: row.donor_phone,
          email: row.donor_email,
          lat: row.pickup_lat ? parseFloat(row.pickup_lat) : null,
          lng: row.pickup_lng ? parseFloat(row.pickup_lng) : null,
          eta: row.pickup_eta,
          actual_time: row.actual_pickup_time
        },
        dropoff: {
          org_name: row.recipient_org_name,
          address: row.recipient_address,
          phone: row.recipient_phone,
          email: row.recipient_email,
          lat: row.dropoff_lat ? parseFloat(row.dropoff_lat) : null,
          lng: row.dropoff_lng ? parseFloat(row.dropoff_lng) : null,
          eta: row.dropoff_eta,
          actual_time: row.actual_delivery_time
        },
        delivery_id: row.delivery_id
      }
    });
  } catch (err) {
    console.error('Fetch driver assignment error:', err);
    res.status(500).json({ error: 'Failed to fetch assignment', details: err.message });
  }
});

/**
 * POST /api/drivers/me/assignment/:donationId/picked-up
 * Task 4 & ARCHITECTURE.md §5:
 * Sets donation status to 'picked_up', populates deliveries.actual_pickup_time.
 * Enforces that current status MUST be 'matched' (no out-of-order transitions).
 */
router.post('/me/assignment/:donationId/picked-up', authenticateToken, requireRole('driver'), async (req, res) => {
  const { donationId } = req.params;
  const driverId = req.user.profileId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify donation exists and is assigned to this driver
    const donRes = await client.query(
      `SELECT id, status, matched_driver_id
       FROM donations
       WHERE id = $1 AND matched_driver_id = $2
       FOR UPDATE`,
      [donationId, driverId]
    );

    if (donRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Assignment not found for this driver' });
    }

    const currentStatus = donRes.rows[0].status;

    // Strict status enum progression: matched -> picked_up
    if (currentStatus !== 'matched') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cannot mark picked_up from status: '${currentStatus}'. Expected status: 'matched'`
      });
    }

    const now = new Date();

    // Update donation status to 'picked_up'
    await client.query(
      `UPDATE donations SET status = 'picked_up' WHERE id = $1`,
      [donationId]
    );

    // Update deliveries table with actual_pickup_time
    await client.query(
      `UPDATE deliveries
       SET actual_pickup_time = $1
       WHERE donation_id = $2 AND driver_id = $3`,
      [now.toISOString(), donationId, driverId]
    );

    await client.query('COMMIT');

    // Emit WebSocket "donation:status_changed"
    const io = req.app.get('io');
    if (io) {
      io.emit('donation:status_changed', {
        donationId,
        status: 'picked_up',
        timestamp: now.toISOString()
      });
    }

    console.log(`[Dispatch] Driver ${driverId} marked donation ${donationId} as picked_up`);

    res.json({
      message: 'Donation marked as picked up',
      status: 'picked_up',
      donationId,
      actual_pickup_time: now.toISOString()
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Mark picked-up error:', err);
    res.status(500).json({ error: 'Failed to mark picked up', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/drivers/me/assignment/:donationId/delivered
 * Task 5 & ARCHITECTURE.md §5:
 * Sets donation status to 'delivered', sets deliveries.actual_delivery_time,
 * sets driver status back to 'available', and triggers impact calculation.
 * STRICT: Rejects if status is not 'picked_up' (no skipping matched -> delivered).
 */
router.post('/me/assignment/:donationId/delivered', authenticateToken, requireRole('driver'), async (req, res) => {
  const { donationId } = req.params;
  const driverId = req.user.profileId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify donation exists and is assigned to this driver
    const donRes = await client.query(
      `SELECT id, status, matched_driver_id, weight_kg, quantity
       FROM donations
       WHERE id = $1 AND matched_driver_id = $2
       FOR UPDATE`,
      [donationId, driverId]
    );

    if (donRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Assignment not found for this driver' });
    }

    const currentStatus = donRes.rows[0].status;

    // Strict state machine: MUST be picked_up to deliver.
    // Do Not rule: "Do not let a driver skip from matched directly to delivered"
    if (currentStatus === 'matched') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: "Cannot mark delivered before pickup. Please mark as picked up first."
      });
    }

    if (currentStatus !== 'picked_up') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cannot mark delivered from status: '${currentStatus}'. Expected status: 'picked_up'`
      });
    }

    const now = new Date();

    // Update donation status to 'delivered'
    await client.query(
      `UPDATE donations SET status = 'delivered' WHERE id = $1`,
      [donationId]
    );

    // Update deliveries table with actual_delivery_time
    await client.query(
      `UPDATE deliveries
       SET actual_delivery_time = $1
       WHERE donation_id = $2 AND driver_id = $3`,
      [now.toISOString(), donationId, driverId]
    );

    // Set driver status back to 'available'
    await client.query(
      `UPDATE drivers SET status = 'available' WHERE id = $1`,
      [driverId]
    );

    // Record impact calculation (Task 5 & Phase 4 prep)
    await recordImpact(donationId, client);

    await client.query('COMMIT');

    // Emit WebSocket "donation:status_changed"
    const io = req.app.get('io');
    if (io) {
      io.emit('donation:status_changed', {
        donationId,
        status: 'delivered',
        timestamp: now.toISOString()
      });
    }

    console.log(`[Dispatch] Driver ${driverId} marked donation ${donationId} as delivered. Driver is now available.`);

    // Check if any awaiting donations can now be assigned to this driver
    try {
      await checkAwaitingDriverDonations();
    } catch (dErr) {
      console.error('Error dispatching awaiting donations on delivery:', dErr);
    }

    res.json({
      message: 'Donation marked as delivered',
      status: 'delivered',
      donationId,
      actual_delivery_time: now.toISOString()
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Mark delivered error:', err);
    res.status(500).json({ error: 'Failed to mark delivered', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/drivers/me/assignment/:donationId/report-issue
 * Logs courier exception ticket and alerts operations dispatch
 */
router.post('/me/assignment/:donationId/report-issue', authenticateToken, requireRole('driver'), async (req, res) => {
  try {
    const { donationId } = req.params;
    const driverId = req.user.profileId;
    const { issue_type, description, notes } = req.body;

    if (!issue_type || !description) {
      return res.status(400).json({ error: 'issue_type and description are required' });
    }

    const result = await pool.query(
      `INSERT INTO driver_issues (donation_id, driver_id, issue_type, description, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, issue_type, description, notes, created_at`,
      [donationId, driverId, issue_type, description, notes || '']
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('driver:issue_reported', {
        issueId: result.rows[0].id,
        donationId,
        driverId,
        issue_type,
        description,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: 'Issue reported to dispatch operations successfully',
      issue: result.rows[0]
    });
  } catch (err) {
    console.error('Report issue error:', err);
    res.status(500).json({ error: 'Failed to report issue', details: err.message });
  }
});

/**
 * GET /api/drivers/me/issues
 * Returns support requests / issue tickets for the authenticated driver
 */
router.get('/me/issues', authenticateToken, requireRole('driver'), async (req, res) => {
  try {
    const driverId = req.user.profileId;
    const query = `
      SELECT i.id, i.donation_id, i.driver_id, i.issue_type, i.description, i.notes,
             COALESCE(i.status, 'open') AS status,
             COALESCE(i.priority, 'normal') AS priority,
             i.created_at,
             d.food_description
      FROM driver_issues i
      LEFT JOIN donations d ON d.id = i.donation_id
      WHERE i.driver_id = $1
      ORDER BY i.created_at DESC
    `;
    const result = await pool.query(query, [driverId]);
    res.json({ issues: result.rows });
  } catch (err) {
    console.error('Fetch driver issues error:', err);
    res.status(500).json({ error: 'Failed to fetch issues', details: err.message });
  }
});

/**
 * POST /api/drivers/me/issues
 * Driver submits a general or assignment-specific support request / issue ticket
 */
router.post('/me/issues', authenticateToken, requireRole('driver'), async (req, res) => {
  try {
    const driverId = req.user.profileId;
    const { donation_id, issue_type, description, priority, notes } = req.body;

    if (!issue_type || !description) {
      return res.status(400).json({ error: 'issue_type and description are required' });
    }

    const result = await pool.query(
      `INSERT INTO driver_issues (donation_id, driver_id, issue_type, description, priority, status, notes)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)
       RETURNING id, donation_id, driver_id, issue_type, description, priority, status, notes, created_at`,
      [donation_id || null, driverId, issue_type, description, priority || 'normal', notes || '']
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('driver:issue_reported', {
        issueId: result.rows[0].id,
        donationId: donation_id || null,
        driverId,
        issue_type,
        description,
        priority: priority || 'normal',
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      message: 'Support request submitted to dispatch operations.',
      issue: result.rows[0]
    });
  } catch (err) {
    console.error('Create support issue error:', err);
    res.status(500).json({ error: 'Failed to submit support issue', details: err.message });
  }
});

/**
 * GET /api/drivers/me/donations
 * Returns all donations associated with the authenticated driver
 * Filters strictly by authenticated driver's ID
 */
router.get('/me/donations', authenticateToken, requireRole('driver'), async (req, res) => {
  try {
    const driverId = req.user.profileId;

    const query = `
      SELECT d.id AS donation_id, d.food_description, d.food_type, d.quantity, d.unit, d.weight_kg,
             d.pickup_address, d.posted_at, d.expiry_window_end, d.status AS donation_status,
             d.notes, d.temperature_condition,
             dn.org_name AS donor_org_name, dn.contact_phone AS donor_phone, dn.contact_email AS donor_email,
             r.org_name AS recipient_org_name, r.address_text AS recipient_address,
             r.contact_phone AS recipient_phone, r.contact_email AS recipient_email,
             drv.name AS driver_name, drv.contact_phone AS driver_phone,
             del.id AS delivery_id, del.pickup_eta, del.dropoff_eta,
             del.actual_pickup_time, del.actual_delivery_time,
             ST_Y(d.pickup_location::geometry) AS pickup_lat,
             ST_X(d.pickup_location::geometry) AS pickup_lng,
             ST_Y(r.location::geometry) AS dropoff_lat,
             ST_X(r.location::geometry) AS dropoff_lng
      FROM donations d
      JOIN donors dn ON dn.id = d.donor_id
      LEFT JOIN recipients r ON r.id = d.matched_recipient_id
      LEFT JOIN drivers drv ON drv.id = d.matched_driver_id
      LEFT JOIN deliveries del ON del.donation_id = d.id AND del.driver_id = $1
      WHERE d.matched_driver_id = $1 OR del.driver_id = $1
      ORDER BY COALESCE(del.actual_delivery_time, del.actual_pickup_time, d.posted_at) DESC
    `;

    const result = await pool.query(query, [driverId]);

    const donations = result.rows.map(row => {
      const now = new Date();
      const expiryDate = new Date(row.expiry_window_end);
      const expiresInSeconds = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000));

      let handlingRequirements = row.notes || 'Standard Perishable Transport';
      let tempRange = 'Ambient (15°C - 25°C)';

      if (row.temperature_condition) {
        const tc = row.temperature_condition.toLowerCase();
        if (tc.includes('chilled') || tc.includes('refrigerated') || tc === 'chilled') {
          tempRange = 'Chilled / Refrigerated (≤ 4°C)';
        } else if (tc.includes('hot') || tc === 'hot') {
          tempRange = 'Hot Holding (≥ 60°C)';
        } else if (tc.includes('ambient') || tc === 'ambient') {
          tempRange = 'Ambient Room Temperature (15°C - 25°C)';
        } else {
          tempRange = row.temperature_condition;
        }
      } else if (row.food_type === 'prepared_meals') {
        handlingRequirements = 'Hot Holding (≥ 60°C) or Rapid Chill (≤ 4°C). Insulated Thermal Carrier mandatory.';
        tempRange = '≥ 60°C or ≤ 4°C';
      } else if (row.food_type === 'dairy') {
        handlingRequirements = 'Strict Cold Chain (2°C - 4°C). Refrigerated container with ice packs.';
        tempRange = '2°C - 4°C';
      } else if (row.food_type === 'produce') {
        handlingRequirements = 'Cool and ventilated transport (10°C - 15°C). Avoid crushing.';
        tempRange = '10°C - 15°C';
      } else if (row.food_type === 'bakery') {
        handlingRequirements = 'Ambient dry storage. Protect against humidity and stacking damage.';
        tempRange = '18°C - 22°C';
      }

      return {
        id: row.donation_id,
        donation_id: row.donation_id,
        food_description: row.food_description,
        food_type: row.food_type,
        quantity: parseFloat(row.quantity),
        unit: row.unit,
        weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : null,
        status: row.donation_status,
        posted_at: row.posted_at,
        expiry_window_end: row.expiry_window_end,
        expires_in_seconds: expiresInSeconds,
        assignment_code: `Route #FR-${row.donation_id.slice(0, 4).toUpperCase()}`,
        handling_requirements: handlingRequirements,
        temperature_range: tempRange,
        temperature_condition: row.temperature_condition || '',
        notes: row.notes || '',
        driver: {
          name: row.driver_name,
          phone: row.driver_phone
        },
        donor: {
          org_name: row.donor_org_name,
          address: row.pickup_address,
          phone: row.donor_phone,
          email: row.donor_email,
          lat: row.pickup_lat ? parseFloat(row.pickup_lat) : null,
          lng: row.pickup_lng ? parseFloat(row.pickup_lng) : null,
        },
        recipient: {
          org_name: row.recipient_org_name,
          address: row.recipient_address,
          phone: row.recipient_phone,
          email: row.recipient_email,
          lat: row.dropoff_lat ? parseFloat(row.dropoff_lat) : null,
          lng: row.dropoff_lng ? parseFloat(row.dropoff_lng) : null,
        },
        delivery: {
          id: row.delivery_id,
          pickup_eta: row.pickup_eta,
          dropoff_eta: row.dropoff_eta,
          actual_pickup_time: row.actual_pickup_time,
          actual_delivery_time: row.actual_delivery_time
        }
      };
    });

    res.json({ donations });
  } catch (err) {
    console.error('Fetch driver donations error:', err);
    res.status(500).json({ error: 'Failed to fetch driver donations', details: err.message });
  }
});

/**
 * GET /api/drivers/me/donations/:id
 * Returns single donation detail for the authenticated driver
 */
router.get('/me/donations/:id', authenticateToken, requireRole('driver'), async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user.profileId;

    const query = `
      SELECT d.id AS donation_id, d.food_description, d.food_type, d.quantity, d.unit, d.weight_kg,
             d.pickup_address, d.posted_at, d.expiry_window_end, d.status AS donation_status,
             d.notes, d.temperature_condition,
             dn.org_name AS donor_org_name, dn.contact_phone AS donor_phone, dn.contact_email AS donor_email,
             r.org_name AS recipient_org_name, r.address_text AS recipient_address,
             r.contact_phone AS recipient_phone, r.contact_email AS recipient_email,
             drv.name AS driver_name, drv.contact_phone AS driver_phone,
             del.id AS delivery_id, del.pickup_eta, del.dropoff_eta,
             del.actual_pickup_time, del.actual_delivery_time,
             ST_Y(d.pickup_location::geometry) AS pickup_lat,
             ST_X(d.pickup_location::geometry) AS pickup_lng,
             ST_Y(r.location::geometry) AS dropoff_lat,
             ST_X(r.location::geometry) AS dropoff_lng
      FROM donations d
      JOIN donors dn ON dn.id = d.donor_id
      LEFT JOIN recipients r ON r.id = d.matched_recipient_id
      LEFT JOIN drivers drv ON drv.id = d.matched_driver_id
      LEFT JOIN deliveries del ON del.donation_id = d.id AND del.driver_id = $2
      WHERE d.id = $1 AND (d.matched_driver_id = $2 OR del.driver_id = $2)
    `;

    const result = await pool.query(query, [id, driverId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donation not found or not assigned to this driver' });
    }

    const row = result.rows[0];
    const now = new Date();
    const expiryDate = new Date(row.expiry_window_end);
    const expiresInSeconds = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000));

    let handlingRequirements = row.notes || 'Standard Perishable Transport';
    let tempRange = 'Ambient (15°C - 25°C)';

    if (row.temperature_condition) {
      const tc = row.temperature_condition.toLowerCase();
      if (tc.includes('chilled') || tc.includes('refrigerated') || tc === 'chilled') {
        tempRange = 'Chilled / Refrigerated (≤ 4°C)';
      } else if (tc.includes('hot') || tc === 'hot') {
        tempRange = 'Hot Holding (≥ 60°C)';
      } else if (tc.includes('ambient') || tc === 'ambient') {
        tempRange = 'Ambient Room Temperature (15°C - 25°C)';
      } else {
        tempRange = row.temperature_condition;
      }
    } else if (row.food_type === 'prepared_meals') {
      handlingRequirements = 'Hot Holding (≥ 60°C) or Rapid Chill (≤ 4°C). Insulated Thermal Carrier mandatory.';
      tempRange = '≥ 60°C or ≤ 4°C';
    } else if (row.food_type === 'dairy') {
      handlingRequirements = 'Strict Cold Chain (2°C - 4°C). Refrigerated container with ice packs.';
      tempRange = '2°C - 4°C';
    } else if (row.food_type === 'produce') {
      handlingRequirements = 'Cool and ventilated transport (10°C - 15°C). Avoid crushing.';
      tempRange = '10°C - 15°C';
    } else if (row.food_type === 'bakery') {
      handlingRequirements = 'Ambient dry storage. Protect against humidity and stacking damage.';
      tempRange = '18°C - 22°C';
    }

    res.json({
      donation: {
        id: row.donation_id,
        donation_id: row.donation_id,
        food_description: row.food_description,
        food_type: row.food_type,
        quantity: parseFloat(row.quantity),
        unit: row.unit,
        weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : null,
        status: row.donation_status,
        posted_at: row.posted_at,
        expiry_window_end: row.expiry_window_end,
        expires_in_seconds: expiresInSeconds,
        assignment_code: `Route #FR-${row.donation_id.slice(0, 4).toUpperCase()}`,
        handling_requirements: handlingRequirements,
        temperature_range: tempRange,
        temperature_condition: row.temperature_condition || '',
        notes: row.notes || '',
        driver: {
          name: row.driver_name,
          phone: row.driver_phone
        },
        donor: {
          org_name: row.donor_org_name,
          address: row.pickup_address,
          phone: row.donor_phone,
          email: row.donor_email,
          lat: row.pickup_lat ? parseFloat(row.pickup_lat) : null,
          lng: row.pickup_lng ? parseFloat(row.pickup_lng) : null,
        },
        recipient: {
          org_name: row.recipient_org_name,
          address: row.recipient_address,
          phone: row.recipient_phone,
          email: row.recipient_email,
          lat: row.dropoff_lat ? parseFloat(row.dropoff_lat) : null,
          lng: row.dropoff_lng ? parseFloat(row.dropoff_lng) : null,
        },
        delivery: {
          id: row.delivery_id,
          pickup_eta: row.pickup_eta,
          dropoff_eta: row.dropoff_eta,
          actual_pickup_time: row.actual_pickup_time,
          actual_delivery_time: row.actual_delivery_time
        }
      }
    });
  } catch (err) {
    console.error('Fetch donation detail error:', err);
    res.status(500).json({ error: 'Failed to fetch donation details', details: err.message });
  }
});

/**
 * POST /api/drivers/me/intake
 * Driver creates a real Donation record associated with their authenticated profile
 */
router.post('/me/intake', authenticateToken, requireRole('driver'), async (req, res) => {
  const client = await pool.connect();
  try {
    const driverId = req.user.profileId;

    // Support flexible field mappings
    const donorName = (req.body.donor_name || req.body.donorName || req.body.donor_organization || '').trim();
    const pickupAddress = (req.body.pickup_address || req.body.pickupAddress || '').trim();
    const foodType = req.body.food_type || req.body.foodCategory || 'prepared_meals';
    const rawQty = req.body.quantity || req.body.estimated_weight_kg || req.body.estimatedWeight;
    const quantity = parseFloat(rawQty) || 10;
    const temperatureCondition = (req.body.temperature_condition || req.body.temperatureState || 'Chilled / Refrigerated').trim();
    const notes = (req.body.notes || req.body.handling_notes || req.body.handlingNotes || '').trim();

    if (!donorName) {
      return res.status(400).json({ error: 'Donor Organization / Establishment is required' });
    }
    if (!pickupAddress) {
      return res.status(400).json({ error: 'Pickup Location / Address is required' });
    }
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    const validFoodTypes = ['prepared_meals', 'produce', 'bakery', 'dairy', 'dry_goods', 'other'];
    const finalFoodType = validFoodTypes.includes(foodType) ? foodType : 'prepared_meals';

    await client.query('BEGIN');

    // Fetch driver details
    const drvRes = await client.query(
      `SELECT id, name, contact_phone, 
              ST_Y(current_location::geometry) AS lat, 
              ST_X(current_location::geometry) AS lng 
       FROM drivers WHERE id = $1`,
      [driverId]
    );
    const driver = drvRes.rows[0];

    let pickupLat = driver?.lat || 28.6139;
    let pickupLng = driver?.lng || 77.2090;

    // Check or create donor
    let donorRes = await client.query(
      `SELECT id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng 
       FROM donors 
       WHERE LOWER(org_name) = LOWER($1) 
       LIMIT 1`,
      [donorName]
    );

    let donorId;
    if (donorRes.rows.length > 0) {
      donorId = donorRes.rows[0].id;
      if (donorRes.rows[0].lat && donorRes.rows[0].lng) {
        pickupLat = parseFloat(donorRes.rows[0].lat);
        pickupLng = parseFloat(donorRes.rows[0].lng);
      }
    } else {
      const emailSlug = donorName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24);
      const fakeEmail = `${emailSlug || 'intake'}_${Date.now().toString().slice(-4)}@donor.foodrescue.org`;
      const newDonor = await client.query(
        `INSERT INTO donors (org_name, contact_email, address_text, location, city_id)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, 'demo-city')
         RETURNING id`,
        [donorName, fakeEmail, pickupAddress, pickupLng, pickupLat]
      );
      donorId = newDonor.rows[0].id;
    }

    // Friendly food category label for description
    const categoryLabels = {
      prepared_meals: 'Prepared Meals / Trays',
      produce: 'Fresh Produce',
      bakery: 'Bakery & Bread',
      dairy: 'Dairy & Refrigerated Items',
      dry_goods: 'Dry Goods & Pantry Staple',
      other: 'Perishable Surplus Food'
    };
    const foodDescription = `${categoryLabels[finalFoodType] || 'Surplus Food'} (${donorName})`;

    const now = new Date();
    const expiryWindow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    // Create real Donation record with status 'intake_requested' and matched_driver_id
    const insertDonation = await client.query(
      `INSERT INTO donations (
         donor_id,
         food_description,
         food_type,
         quantity,
         unit,
         weight_kg,
         pickup_location,
         pickup_address,
         posted_at,
         expiry_window_end,
         status,
         matched_driver_id,
         city_id,
         notes,
         temperature_condition
       )
       VALUES (
         $1, $2, $3, $4, 'kg', $5,
         ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
         $8, $9, $10, 'intake_requested', $11, 'demo-city', $12, $13
       )
       RETURNING id, donor_id, food_description, food_type, quantity, unit, weight_kg,
                 pickup_address, posted_at, expiry_window_end, status, matched_driver_id,
                 notes, temperature_condition`,
      [
        donorId,
        foodDescription,
        finalFoodType,
        quantity,
        quantity,
        pickupLng,
        pickupLat,
        pickupAddress,
        now.toISOString(),
        expiryWindow.toISOString(),
        driverId,
        notes,
        temperatureCondition
      ]
    );

    const donation = insertDonation.rows[0];

    // Create delivery record linked to this donation and driver
    const pickupEta = new Date(now.getTime() + 15 * 60 * 1000);
    const dropoffEta = new Date(now.getTime() + 60 * 60 * 1000);
    const delRes = await client.query(
      `INSERT INTO deliveries (donation_id, driver_id, pickup_eta, dropoff_eta)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [donation.id, driverId, pickupEta.toISOString(), dropoffEta.toISOString()]
    );

    await client.query('COMMIT');

    // Emit real-time WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.emit('driver:field_intake', {
        donationId: donation.id,
        driverId,
        donorName,
        pickupAddress,
        foodType: finalFoodType,
        quantity,
        temperatureCondition,
        timestamp: now.toISOString()
      });
      io.emit('donation:status_changed', {
        donationId: donation.id,
        status: 'intake_requested',
        timestamp: now.toISOString()
      });
    }

    console.log(`[Dispatch] Driver ${driverId} created donation ${donation.id} from ${donorName}`);

    res.status(201).json({
      message: 'Donation intake submitted successfully.',
      donation: {
        id: donation.id,
        donation_id: donation.id,
        food_description: donation.food_description,
        food_type: donation.food_type,
        quantity: parseFloat(donation.quantity),
        unit: donation.unit,
        weight_kg: parseFloat(donation.weight_kg),
        status: donation.status,
        posted_at: donation.posted_at,
        donor_name: donorName,
        pickup_address: donation.pickup_address,
        temperature_condition: donation.temperature_condition,
        notes: donation.notes,
        driver_id: driverId,
        delivery_id: delRes.rows[0].id
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Driver field intake error:', err);
    res.status(500).json({ error: 'Failed to create donation intake', details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
