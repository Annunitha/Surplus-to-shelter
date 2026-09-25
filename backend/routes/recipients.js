const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { acceptOffer, rejectOffer, getActiveOffers } = require('../services/matching');

const router = express.Router();

/**
 * GET /api/recipients/me
 * Returns current recipient profile (capacity, preferences, location)
 */
router.get('/me', authenticateToken, requireRole('recipient'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, org_name, contact_email, contact_phone, address_text,
              accepted_food_types, capacity_current, capacity_max,
              ST_Y(location::geometry) AS lat,
              ST_X(location::geometry) AS lng,
              created_at,
              COALESCE(updated_at, created_at) AS updated_at
       FROM recipients
       WHERE id = $1`,
      [req.user.profileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient profile not found' });
    }

    const r = result.rows[0];
    res.json({
      recipient: {
        id: r.id,
        org_name: r.org_name,
        contact_email: r.contact_email,
        contact_phone: r.contact_phone,
        address_text: r.address_text,
        accepted_food_types: r.accepted_food_types,
        capacity_current: parseFloat(r.capacity_current),
        capacity_max: parseFloat(r.capacity_max),
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
        created_at: r.created_at,
        updated_at: r.updated_at
      }
    });
  } catch (err) {
    console.error('Fetch recipient profile error:', err);
    res.status(500).json({ error: 'Failed to fetch recipient profile', details: err.message });
  }
});

/**
 * PATCH /api/recipients/me
 * Update capacity / accepted_food_types (Task 6 & ARCHITECTURE.md §5)
 */
router.patch('/me', authenticateToken, requireRole('recipient'), async (req, res) => {
  try {
    const { capacity_current, capacity_max, accepted_food_types } = req.body;
    const recipientId = req.user.profileId;

    const updates = [];
    const values = [];
    let idx = 1;

    if (capacity_current !== undefined) {
      const cur = parseFloat(capacity_current);
      if (isNaN(cur) || cur < 0) {
        return res.status(400).json({ error: 'capacity_current must be a non-negative number' });
      }
      updates.push(`capacity_current = $${idx++}`);
      values.push(cur);
    }

    if (capacity_max !== undefined) {
      const max = parseFloat(capacity_max);
      if (isNaN(max) || max <= 0) {
        return res.status(400).json({ error: 'capacity_max must be a positive number' });
      }
      updates.push(`capacity_max = $${idx++}`);
      values.push(max);
    }

    if (accepted_food_types !== undefined) {
      if (!Array.isArray(accepted_food_types) || accepted_food_types.length === 0) {
        return res.status(400).json({ error: 'accepted_food_types must be a non-empty array' });
      }
      const validTypes = ['prepared_meals', 'produce', 'bakery', 'dairy', 'dry_goods', 'other'];
      const allValid = accepted_food_types.every(t => validTypes.includes(t));
      if (!allValid) {
        return res.status(400).json({
          error: `Invalid food type. Must be one of: ${validTypes.join(', ')}`
        });
      }
      updates.push(`accepted_food_types = $${idx++}`);
      values.push(accepted_food_types);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    updates.push(`updated_at = now()`);
    values.push(recipientId);
    const query = `
      UPDATE recipients
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING id, org_name, accepted_food_types, capacity_current, capacity_max, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    const updated = result.rows[0];

    res.json({
      message: 'Recipient preferences updated successfully',
      recipient: {
        id: updated.id,
        org_name: updated.org_name,
        accepted_food_types: updated.accepted_food_types,
        capacity_current: parseFloat(updated.capacity_current),
        capacity_max: parseFloat(updated.capacity_max),
        created_at: updated.created_at,
        updated_at: updated.updated_at
      }
    });
  } catch (err) {
    console.error('Update recipient preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences', details: err.message });
  }
});

/**
 * GET /api/recipients/me/dashboard
 * Returns stats: available offers, accepted donations, incoming deliveries, received today, recent activity
 */
router.get('/me/dashboard', authenticateToken, requireRole('recipient'), async (req, res) => {
  try {
    const recipientId = req.user.profileId;

    const activeOffersMap = getActiveOffers();
    let inMemOffersCount = 0;
    if (activeOffersMap && typeof activeOffersMap.entries === 'function') {
      for (const [_, off] of activeOffersMap.entries()) {
        if (off.recipientId === recipientId) inMemOffersCount++;
      }
    }

    const dbOffersRes = await pool.query(
      `SELECT COUNT(*) FROM donations WHERE matched_recipient_id = $1 AND status = 'posted' AND expiry_window_end > now()`,
      [recipientId]
    );
    const dbOffersCount = parseInt(dbOffersRes.rows[0].count, 10) || 0;
    const availableOffers = Math.max(inMemOffersCount, dbOffersCount);

    const acceptedRes = await pool.query(
      `SELECT COUNT(*) FROM donations WHERE matched_recipient_id = $1 AND status IN ('matched', 'picked_up', 'in_transit')`,
      [recipientId]
    );

    const incomingRes = await pool.query(
      `SELECT COUNT(*) FROM donations WHERE matched_recipient_id = $1 AND status IN ('picked_up', 'in_transit')`,
      [recipientId]
    );

    const receivedRes = await pool.query(
      `SELECT COUNT(*) FROM donations WHERE matched_recipient_id = $1 AND status = 'delivered'`,
      [recipientId]
    );

    const recentRes = await pool.query(
      `SELECT d.id, d.food_description, d.food_type, d.quantity, d.unit, d.weight_kg,
              d.status, d.posted_at, dn.org_name AS donor_name, dr.name AS driver_name,
              (SELECT ROUND(AVG(f.rating), 2) FROM feedback f WHERE f.driver_id = d.matched_driver_id) AS driver_rating,
              del.pickup_eta, del.dropoff_eta, del.actual_delivery_time
       FROM donations d
       JOIN donors dn ON dn.id = d.donor_id
       LEFT JOIN drivers dr ON dr.id = d.matched_driver_id
       LEFT JOIN deliveries del ON del.donation_id = d.id
       WHERE d.matched_recipient_id = $1
       ORDER BY d.posted_at DESC
       LIMIT 10`,
      [recipientId]
    );

    res.json({
      stats: {
        available_offers: availableOffers,
        accepted_donations: parseInt(acceptedRes.rows[0].count, 10) || 0,
        incoming_deliveries: parseInt(incomingRes.rows[0].count, 10) || 0,
        received_today: parseInt(receivedRes.rows[0].count, 10) || 0
      },
      recent_donations: recentRes.rows
    });
  } catch (err) {
    console.error('Fetch recipient dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats', details: err.message });
  }
});

/**
 * GET /api/recipients/me/offers
 * (recipient) Posted, unexpired donations eligible for this recipient, with live expiry countdown
 * NFR-3: A donation whose expiry has passed NEVER appears as an offer.
 * NFR-4: Donor contact details are hidden until match reaches 'matched' status.
 */
router.get('/me/offers', authenticateToken, requireRole('recipient'), async (req, res) => {
  try {
    const recipientId = req.user.profileId;
    const now = new Date();

    const query = `
      SELECT d.id, d.food_description, d.food_type, d.quantity, d.unit, d.weight_kg,
             d.pickup_address, d.posted_at, d.expiry_window_end, d.status,
             (ST_Distance(r.location, d.pickup_location) / 1000.0) AS distance_km
      FROM donations d
      JOIN recipients r ON r.id = $1
      WHERE d.status = 'posted'
        AND d.expiry_window_end > $2
        AND r.capacity_current < r.capacity_max
        AND instr(r.accepted_food_types, '"' || d.food_type || '"') > 0
      ORDER BY d.posted_at DESC
    `;

    const result = await pool.query(query, [recipientId, now.toISOString()]);
    const activeOffersMap = getActiveOffers();

    const offers = result.rows.map(row => {
      const expiryDate = new Date(row.expiry_window_end);
      const remainingSeconds = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000));
      
      const offerMeta = activeOffersMap.get(row.id);
      let offerTimeoutRemaining = 900;
      if (offerMeta?.offeredAt) {
        const elapsed = Math.floor((Date.now() - offerMeta.offeredAt) / 1000);
        offerTimeoutRemaining = Math.max(0, 900 - elapsed);
      }

      return {
        id: row.id,
        food_description: row.food_description,
        food_type: row.food_type,
        quantity: parseFloat(row.quantity),
        unit: row.unit,
        weight_kg: parseFloat(row.weight_kg),
        pickup_address: row.pickup_address,
        distance_km: row.distance_km ? parseFloat(parseFloat(row.distance_km).toFixed(2)) : null,
        posted_at: row.posted_at,
        expiry_window_end: row.expiry_window_end,
        expires_in_seconds: remainingSeconds,
        offer_timeout_remaining_seconds: offerTimeoutRemaining,
        status: row.status
      };
    });

    res.json({ offers });
  } catch (err) {
    console.error('Fetch recipient offers error:', err);
    res.status(500).json({ error: 'Failed to fetch offers', details: err.message });
  }
});

/**
 * GET /api/recipients/me/offers/:donationId/drivers
 * Available drivers ordered by rating, then distance to the donation pickup.
 */
router.get('/me/offers/:donationId/drivers', authenticateToken, requireRole('recipient'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT drv.id, drv.name, drv.status,
              COALESCE((SELECT ROUND(AVG(f.rating), 2) FROM feedback f WHERE f.driver_id = drv.id), 0) AS average_rating,
              (ST_Distance(drv.current_location, d.pickup_location) / 1000.0) AS distance_km
       FROM drivers drv
       JOIN donations d ON d.id = $1
       WHERE drv.status = 'available'
       ORDER BY average_rating DESC, ST_Distance(drv.current_location, d.pickup_location) ASC`,
      [req.params.donationId]
    );

    res.json({
      drivers: result.rows.map(driver => ({
        id: driver.id,
        name: driver.name,
        status: driver.status,
        average_rating: Number(driver.average_rating) || 0,
        distance_km: driver.distance_km == null ? null : Number(Number(driver.distance_km).toFixed(2))
      }))
    });
  } catch (err) {
    console.error('Fetch available drivers error:', err);
    res.status(500).json({ error: 'Failed to fetch available drivers', details: err.message });
  }
});

/**
 * POST /api/recipients/me/offers/:donationId/accept
 * Sets donation status to 'matched', increments recipient capacity_current (FR-3.3)
 */
router.post('/me/offers/:donationId/accept', authenticateToken, requireRole('recipient'), async (req, res) => {
  try {
    const { donationId } = req.params;
    const recipientId = req.user.profileId;

    const result = await acceptOffer(donationId, recipientId, req.body.driver_id || null);
    res.json({
      message: 'Offer accepted successfully',
      status: result.status,
      donationId,
      driverId: result.driver?.id || null,
      driverName: result.driver?.name || null,
      driverRating: result.driver?.average_rating ?? null
    });
  } catch (err) {
    console.error('Accept offer error:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/recipients/me/offers/:donationId/reject
 * Clears the offer, immediately re-runs matching against remaining candidates (FR-3.4)
 */
router.post('/me/offers/:donationId/reject', authenticateToken, requireRole('recipient'), async (req, res) => {
  try {
    const { donationId } = req.params;
    const recipientId = req.user.profileId;

    const cascadeResult = await rejectOffer(donationId, recipientId);
    res.json({
      message: 'Offer rejected',
      donationId,
      cascaded: cascadeResult.matched,
      nextRecipientId: cascadeResult.recipient?.id || null
    });
  } catch (err) {
    console.error('Reject offer error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
