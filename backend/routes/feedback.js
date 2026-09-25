const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Ratings are accepted only from a donor or recipient for an accepted delivery.
router.post('/', authenticateToken, requireRole('donor', 'recipient'), async (req, res) => {
    try {
        const { name, rating, comments, driver_id, donation_id } = req.body;
        const numericRating = Number(rating);

        if (!name || !comments || !driver_id || !donation_id || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ error: 'Name, rating from 1 to 5, comments, driver_id, and donation_id are required.' });
        }

        const delivery = await pool.query(
            `SELECT id FROM donations
             WHERE id = $1 AND status IN ('matched', 'picked_up', 'in_transit', 'delivered') AND matched_driver_id = $2
                 AND ($3 = 'donor' AND donor_id = $4 OR $3 = 'recipient' AND matched_recipient_id = $4)`,
            [donation_id, driver_id, req.user.role, req.user.profileId]
        );

        if (delivery.rows.length === 0) {
            return res.status(403).json({ error: 'Feedback is available only after this driver completes the delivery.' });
        }

        const existing = await pool.query(
            `SELECT id FROM feedback WHERE donation_id = $1 AND reviewer_id = $2`,
            [donation_id, req.user.profileId]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'You already rated this delivery.' });
        }

        const result = await pool.query(
            `INSERT INTO feedback (name, rating, comments, driver_id, donation_id, reviewer_role, reviewer_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [name.trim(), numericRating, comments.trim(), driver_id, donation_id, req.user.role, req.user.profileId]
        );

        res.status(201).json({ message: 'Driver feedback saved successfully.', feedbackId: result.rows[0].id });
    } catch (err) {
        console.error('Failed to save driver feedback:', err);
        res.status(500).json({ error: 'Database insertion error.', details: err.message });
    }
});

module.exports = router;