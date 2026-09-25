const express = require('express');
const { pool } = require('../db');

const router = express.Router();

/**
 * GET /api/impact/summary
 * Public impact dashboard endpoint (no auth required per SRS FR-6.3)
 * Returns running totals for meals rescued, weight diverted, CO2e avoided,
 * and count of active donations by status.
 */
router.get('/summary', async (req, res) => {
  try {
    // 1. Running totals from impact_log
    const result = await pool.query(`
      SELECT
        COALESCE(SUM(weight_kg), 0) AS total_weight_kg,
        COALESCE(SUM(meals_estimate), 0) AS total_meals,
        COALESCE(SUM(co2e_avoided_kg), 0) AS total_co2e_avoided_kg,
        COUNT(*)::int AS total_deliveries
      FROM impact_log
    `);

    // 2. Breakdown of all donation counts by status
    const statusCounts = await pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM donations
      GROUP BY status
    `);

    const byStatus = {
      posted: 0,
      matched: 0,
      picked_up: 0,
      delivered: 0,
      expired: 0,
      cancelled: 0
    };

    statusCounts.rows.forEach(row => {
      byStatus[row.status] = row.count;
    });

    // 3. Recent delivered rescues for the public feed
    const recentRes = await pool.query(`
      SELECT il.id, il.weight_kg, il.meals_estimate, il.co2e_avoided_kg, il.logged_at,
             d.food_description, d.food_type
      FROM impact_log il
      JOIN donations d ON d.id = il.donation_id
      ORDER BY il.logged_at DESC
      LIMIT 6
    `);

    const totalWeight = parseFloat(parseFloat(result.rows[0].total_weight_kg).toFixed(2));
    const totalMeals = Math.round(parseFloat(result.rows[0].total_meals));
    const totalCo2e = parseFloat(parseFloat(result.rows[0].total_co2e_avoided_kg).toFixed(2));
    const totalDeliveries = result.rows[0].total_deliveries;

    const recentRescues = recentRes.rows.map(r => ({
      id: r.id,
      food_description: r.food_description,
      food_type: r.food_type,
      weight_kg: parseFloat(r.weight_kg),
      meals: Math.round(parseFloat(r.meals_estimate)),
      meals_rescued: Math.round(parseFloat(r.meals_estimate)),
      co2e_avoided_kg: parseFloat(parseFloat(r.co2e_avoided_kg).toFixed(2)),
      logged_at: r.logged_at,
      timestamp: r.logged_at
    }));

    const payload = {
      total_weight_kg: totalWeight,
      total_food_diverted_kg: totalWeight,
      total_meals: totalMeals,
      total_meals_rescued: totalMeals,
      total_co2e_avoided_kg: totalCo2e,
      total_deliveries: totalDeliveries,
      donations_by_status: byStatus,
      active_pipeline: {
        posted: byStatus.posted || 0,
        matched: byStatus.matched || 0,
        in_transit: byStatus.picked_up || 0,
        delivered: byStatus.delivered || totalDeliveries || 0
      },
      recent_rescues: recentRescues
    };

    res.json({
      ...payload,
      summary: payload
    });
  } catch (err) {
    console.error('Impact summary error:', err);
    res.status(500).json({ error: 'Failed to fetch impact summary' });
  }
});

module.exports = router;
