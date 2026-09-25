const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { matchDonation } = require('../services/matching');

const router = express.Router();

/**
 * POST /api/donations
 * (donor) Create a new donation → triggers matching stub
 * 
 * Required fields (SRS §6 — exact set, do not add/remove):
 *   food_description (text), food_type (enum), quantity (number),
 *   unit (enum), pickup_address (text), expiry_window_end (datetime)
 *
 * Weight conversion constants (documented per Phase 1 Task 3):
 *   - If unit is 'kg': weight_kg = quantity
 *   - If unit is 'lbs': weight_kg = quantity * 0.453592
 *   - If unit is 'servings': weight_kg = quantity * 0.4 (estimate: ~0.4 kg/serving)
 */
router.post('/', authenticateToken, requireRole('donor'), async (req, res) => {
  try {
    const {
      food_description,
      food_type,
      quantity,
      unit,
      pickup_address,
      expiry_window_end,
      fssai_certificate_name,
      fssai_certificate_type,
      fssai_certificate_data_url
    } = req.body;

    // --- Validate required fields ---
    if (!food_description || !food_type || quantity == null || !unit || !pickup_address || !expiry_window_end) {
      return res.status(400).json({ error: 'All fields are required: food_description, food_type, quantity, unit, pickup_address, expiry_window_end' });
    }

    if (fssai_certificate_data_url || fssai_certificate_name || fssai_certificate_type) {
      const hasValidName = typeof fssai_certificate_name === 'string' && fssai_certificate_name.trim().length > 0;
      const hasValidData = typeof fssai_certificate_data_url === 'string' && fssai_certificate_data_url.startsWith('data:');
      const hasValidType = typeof fssai_certificate_type === 'string' && (
        fssai_certificate_type === 'application/pdf' ||
        fssai_certificate_type.startsWith('image/')
      );

      if (!hasValidName || !hasValidData || !hasValidType) {
        return res.status(400).json({ error: 'FSSAI certificate must include a valid PDF or image file.' });
      }
    }

    // Validate food_type enum
    const VALID_FOOD_TYPES = ['prepared_meals', 'produce', 'bakery', 'dairy', 'dry_goods', 'other'];
    if (!VALID_FOOD_TYPES.includes(food_type)) {
      return res.status(400).json({ error: `food_type must be one of: ${VALID_FOOD_TYPES.join(', ')}` });
    }

    // Validate unit enum
    const VALID_UNITS = ['lbs', 'kg', 'servings'];
    if (!VALID_UNITS.includes(unit)) {
      return res.status(400).json({ error: `unit must be one of: ${VALID_UNITS.join(', ')}` });
    }

    // Validate quantity is positive
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    // --- NFR-3: Reject if expiry_window_end is not in the future ---
    const expiryDate = new Date(expiry_window_end);
    if (isNaN(expiryDate.getTime())) {
      return res.status(400).json({ error: 'expiry_window_end must be a valid datetime' });
    }
    if (expiryDate <= new Date()) {
      return res.status(400).json({ error: 'expiry_window_end must be in the future' });
    }

    // --- Geocode pickup_address → lat/lng using Nominatim ---
    let lat, lng;
    try {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickup_address)}&limit=1`;
      const geocodeResponse = await fetch(geocodeUrl, {
        headers: { 'User-Agent': 'SurplusToShelter/1.0 (hackathon project)' }
      });
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.length === 0) {
        return res.status(400).json({ error: 'Could not geocode the pickup address. Please provide a more specific address.' });
      }
      
      lat = parseFloat(geocodeData[0].lat);
      lng = parseFloat(geocodeData[0].lon);
    } catch (geocodeErr) {
      console.error('Geocoding error:', geocodeErr);
      return res.status(500).json({ error: 'Geocoding service failed. Please try again.' });
    }

    // --- Compute weight_kg from quantity/unit ---
    // Conversion constants (Phase 1 requirement):
    //   kg:       weight_kg = quantity (already in kg)
    //   lbs:      weight_kg = quantity × 0.453592 (standard lb-to-kg conversion)
    //   servings: weight_kg = quantity × 0.4 (estimate ~0.4 kg per serving)
    let weight_kg;
    if (unit === 'kg') {
      weight_kg = quantity;
    } else if (unit === 'lbs') {
      weight_kg = quantity * 0.453592;
    } else if (unit === 'servings') {
      weight_kg = quantity * 0.4; // estimated 0.4 kg per serving
    }

    // --- Insert donation with status 'posted' ---
    const result = await pool.query(
      `INSERT INTO donations (donor_id, food_description, food_type, quantity, unit, weight_kg,
         pickup_location, pickup_address, expiry_window_end, status,
         fssai_certificate_name, fssai_certificate_type, fssai_certificate_data_url)
       VALUES ($1, $2, $3, $4, $5, $6,
         ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9, $10, 'posted', $11, $12, $13)
       RETURNING *`,
      [req.user.profileId, food_description, food_type, quantity, unit, weight_kg,
       lng, lat, pickup_address, expiryDate.toISOString(),
       fssai_certificate_name || null,
       fssai_certificate_type || null,
       fssai_certificate_data_url || null]
    );

    const donation = result.rows[0];

    // --- Trigger matching ---
    // FR-1.3: On submit, system immediately triggers matching
    try {
      await matchDonation(donation.id);
    } catch (mErr) {
      console.error('[Matching] Error during donation matching:', mErr);
    }

    res.status(201).json({
      message: 'Donation posted successfully',
      donation: {
        id: donation.id,
        food_description: donation.food_description,
        food_type: donation.food_type,
        quantity: parseFloat(donation.quantity),
        unit: donation.unit,
        weight_kg: parseFloat(donation.weight_kg),
        pickup_address: donation.pickup_address,
        status: donation.status,
        posted_at: donation.posted_at,
        expiry_window_end: donation.expiry_window_end,
        fssai_certificate_name: donation.fssai_certificate_name || null,
        fssai_certificate_type: donation.fssai_certificate_type || null,
        fssai_certificate_data_url: donation.fssai_certificate_data_url || null
      }
    });
  } catch (err) {
    console.error('Create donation error:', err);
    res.status(500).json({ error: 'Failed to create donation', details: err.message });
  }
});

/**
 * GET /api/donations/mine
 * (donor) List own donations
 */
router.get('/mine', authenticateToken, requireRole('donor'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.food_description, d.food_type, d.quantity, d.unit, d.weight_kg,
              d.pickup_address, d.status, d.posted_at, d.expiry_window_end,
              d.matched_recipient_id, d.matched_driver_id,
              d.fssai_certificate_name, d.fssai_certificate_type, d.fssai_certificate_data_url,
              r.org_name AS recipient_name,
              dr.name AS driver_name,
              (SELECT ROUND(AVG(f.rating), 2) FROM feedback f WHERE f.driver_id = d.matched_driver_id) AS driver_rating,
              CASE
                WHEN d.matched_recipient_id IS NOT NULL AND d.matched_driver_id IS NOT NULL THEN 'Donor → Recipient → Driver'
                WHEN d.matched_recipient_id IS NOT NULL THEN 'Donor → Recipient'
                ELSE 'Donor → Pending match'
              END AS connection_status
       FROM donations d
       LEFT JOIN recipients r ON r.id = d.matched_recipient_id
       LEFT JOIN drivers dr ON dr.id = d.matched_driver_id
       WHERE d.donor_id = $1
       ORDER BY d.posted_at DESC`,
      [req.user.profileId]
    );

    res.json({ donations: result.rows });
  } catch (err) {
    console.error('Get donations error:', err);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

/**
 * GET /api/donations/donor/profile
 * Returns authenticated donor organization profile
 */
router.get('/donor/profile', authenticateToken, requireRole('donor'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, org_name, contact_email, contact_phone, address_text,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
              created_at
       FROM donors
       WHERE id = $1`,
      [req.user.profileId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }
    res.json({ donor: result.rows[0] });
  } catch (err) {
    console.error('Fetch donor profile error:', err);
    res.status(500).json({ error: 'Failed to fetch donor profile' });
  }
});

/**
 * PATCH /api/donations/donor/profile
 * Update donor organization profile
 */
router.patch('/donor/profile', authenticateToken, requireRole('donor'), async (req, res) => {
  try {
    const { org_name, contact_phone, address_text } = req.body;
    const result = await pool.query(
      `UPDATE donors
       SET org_name = COALESCE($1, org_name),
           contact_phone = COALESCE($2, contact_phone),
           address_text = COALESCE($3, address_text)
       WHERE id = $4
       RETURNING id, org_name, contact_email, contact_phone, address_text`,
      [org_name, contact_phone, address_text, req.user.profileId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }
    res.json({ message: 'Profile updated successfully', donor: result.rows[0] });
  } catch (err) {
    console.error('Update donor profile error:', err);
    res.status(500).json({ error: 'Failed to update donor profile' });
  }
});

/**
 * GET /api/donations/:id
 * (any authenticated) View one donation
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, donor_id, food_description, food_type, quantity, unit, weight_kg,
              pickup_address, status, posted_at, expiry_window_end,
              matched_recipient_id, matched_driver_id,
              fssai_certificate_name, fssai_certificate_type, fssai_certificate_data_url,
              ST_Y(pickup_location::geometry) AS lat,
              ST_X(pickup_location::geometry) AS lng
       FROM donations
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    res.json({ donation: result.rows[0] });
  } catch (err) {
    console.error('Get donation error:', err);
    res.status(500).json({ error: 'Failed to fetch donation' });
  }
});

module.exports = router;
