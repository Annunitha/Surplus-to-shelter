const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, org_name, name, contact_phone, address_text, lat, lng,
            accepted_food_types, capacity_max } = req.body;

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanOrgName = typeof org_name === 'string' ? org_name.trim() : '';
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanAddress = typeof address_text === 'string' ? address_text.trim() : '';
    const cleanPhone = typeof contact_phone === 'string' ? contact_phone.trim() : '';
    const hasValidCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
    const safeLat = Number(lat);
    const safeLng = Number(lng);

    // Validate role
    if (!['donor', 'recipient', 'driver'].includes(role)) {
      return res.status(400).json({ error: 'Role must be donor, recipient, or driver' });
    }

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(TRIM(email)) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    let profileId;

    if (role === 'donor') {
      if (!cleanOrgName || !cleanAddress || !hasValidCoords) {
        return res.status(400).json({ error: 'Donor requires a valid org_name and address_text with valid lat/lng' });
      }
      const result = await pool.query(
        `INSERT INTO donors (org_name, contact_email, contact_phone, location, lat, lng, address_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [org_name, email, contact_phone || null, `POINT(${lng} ${lat})`, lat, lng, address_text]
      );
      profileId = result.rows[0].id;

    } else if (role === 'recipient') {
      if (!cleanOrgName || !cleanAddress || !hasValidCoords || !accepted_food_types || !capacity_max) {
        return res.status(400).json({ error: 'Recipient requires a valid org_name, address_text, valid lat/lng, accepted_food_types, and capacity_max' });
      }
      const result = await pool.query(
        `INSERT INTO recipients (org_name, contact_email, contact_phone, location, lat, lng, address_text, accepted_food_types, capacity_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [org_name, email, contact_phone || null, `POINT(${lng} ${lat})`, lat, lng, address_text, accepted_food_types, capacity_max]
      );
      profileId = result.rows[0].id;

    } else if (role === 'driver') {
      if (!cleanName) {
        return res.status(400).json({ error: 'Driver requires a valid name' });
      }
      let result;
      if (hasValidCoords) {
        result = await pool.query(
          `INSERT INTO drivers (name, contact_phone, current_location, lat, lng)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [name, contact_phone || null, `POINT(${lng} ${lat})`, lat, lng]
        );
      } else {
        result = await pool.query(
          `INSERT INTO drivers (name, contact_phone)
           VALUES ($1, $2)
           RETURNING id`,
          [cleanName, cleanPhone || null]
        );
      }
      profileId = result.rows[0].id;
    }

    // Create user record
    await pool.query(
      `INSERT INTO users (email, password_hash, role, profile_id)
       VALUES ($1, $2, $3, $4)`,
      [cleanEmail, password_hash, role, profileId]
    );

    // Generate JWT
    const token = jwt.sign(
      { userId: profileId, role, profileId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, role, profileId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE LOWER(TRIM(email)) = $1', [cleanEmail]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If a role was explicitly selected in the login client, validate it matches account role
    if (role && role !== user.role) {
      return res.status(403).json({
        error: `Role mismatch: This account is registered as "${user.role}", not "${role}". Please select "${user.role.charAt(0).toUpperCase() + user.role.slice(1)}" on the login screen.`
      });
    }

    const token = jwt.sign(
      { userId: user.profile_id, role: user.role, profileId: user.profile_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, role: user.role, profileId: user.profile_id });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

module.exports = router;
