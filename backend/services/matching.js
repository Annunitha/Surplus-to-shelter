const { pool } = require('../db');
const { notifyRecipientOffer } = require('./notifications');

// Configuration constants from ARCHITECTURE.md §4
const DEFAULT_RADIUS_METERS = parseInt(process.env.MATCH_RADIUS_METERS, 10) || 8000;
const OFFER_TIMEOUT_SECONDS = parseInt(process.env.OFFER_TIMEOUT_SECONDS, 10) || 900;

// In-memory tracker for active offers and rejection history:
// donationId -> { recipientId, offeredAt, excludedRecipientIds: Set<string> }
const activeOffers = new Map();

// Reference to Socket.io instance for event emission
let ioInstance = null;

function setSocketIo(io) {
  ioInstance = io;
}

function emitEvent(eventName, payload) {
  if (ioInstance) {
    ioInstance.emit(eventName, payload);
  }
}

async function upsertDonationConnection({ donationId, donorId, recipientId, driverId = null, status = 'matched' }) {
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
 * ARCHITECTURE.md §4: Matching Algorithm
 * 
 * Candidate filter (SQL, PostGIS):
 *   recipients WHERE
 *     ST_DWithin(location, donation.pickup_location, RADIUS_METERS)  -- default 8000
 *     AND food_type = ANY(accepted_food_types)
 *     AND capacity_current < capacity_max
 * 
 * Score per candidate:
 *   distance_km = ST_Distance(location, donation.pickup_location) / 1000
 *   capacity_fit = 1 - (capacity_current / capacity_max)     -- prefers emptier recipients
 *   urgency = 1 - (time_remaining_seconds / initial_window_seconds)  -- rises as expiry nears
 * 
 *   score = (0.5 * (1 / (distance_km + 0.1)))
 *         + (0.3 * capacity_fit)
 *         + (0.2 * urgency)
 * 
 * Weights (0.5 / 0.3 / 0.2) are fixed for MVP per ARCHITECTURE.md §4.
 */
async function matchDonation(donationId, excludedRecipientIds = []) {
  // 1. Fetch donation details
  const donRes = await pool.query(
    `SELECT id, food_description, food_type, quantity, unit, weight_kg,
            pickup_location, pickup_address, posted_at, expiry_window_end,
            status, matched_recipient_id
     FROM donations
     WHERE id = $1`,
    [donationId]
  );

  if (donRes.rows.length === 0) {
    console.warn(`[Matching] Donation ${donationId} not found`);
    activeOffers.delete(donationId);
    return { matched: false, reason: 'not_found' };
  }

  const donation = donRes.rows[0];

  // If donation is not in 'posted' status, matching does not apply
  if (donation.status !== 'posted') {
    return { matched: false, reason: `status_not_posted:${donation.status}` };
  }

  const now = new Date();
  const expiryDate = new Date(donation.expiry_window_end);

  // Hard filter (NFR-3 & FR-2.4): If expiry has already passed, mark expired and reject from matching
  if (expiryDate <= now) {
    console.log(`[Matching] Donation ${donationId} has expired. Updating status to 'expired'.`);
    await pool.query(
      `UPDATE donations SET status = 'expired', matched_recipient_id = NULL WHERE id = $1`,
      [donationId]
    );
    activeOffers.delete(donationId);
    emitEvent('donation:status_changed', {
      donationId,
      status: 'expired',
      timestamp: now.toISOString()
    });
    return { matched: false, reason: 'expired' };
  }

  // Calculate urgency per ARCHITECTURE.md §4
  // urgency = 1 - (time_remaining_seconds / initial_window_seconds)
  const postedDate = new Date(donation.posted_at || now);
  const timeRemainingSeconds = Math.max(0, (expiryDate.getTime() - now.getTime()) / 1000);
  const initialWindowSeconds = Math.max(1, (expiryDate.getTime() - postedDate.getTime()) / 1000);
  const urgency = Math.max(0, Math.min(1, 1 - (timeRemainingSeconds / initialWindowSeconds)));

  // Merge excluded recipient IDs from memory and argument
  const trackedOffer = activeOffers.get(donationId);
  const allExcludedIds = Array.from(
    new Set([...(trackedOffer?.excludedRecipientIds || []), ...(excludedRecipientIds || [])])
  );

  // 2. Query candidate recipients with PostGIS filter and exact scoring formula
  const query = `
    SELECT r.id, r.org_name, r.contact_email, r.contact_phone, r.address_text,
           r.capacity_current, r.capacity_max,
           (ST_Distance(r.location, $1) / 1000.0) AS distance_km,
           (1.0 - (r.capacity_current::float / r.capacity_max::float)) AS capacity_fit,
           (
             0.5 * (1.0 / ((ST_Distance(r.location, $1) / 1000.0) + 0.1))
             + 0.3 * (1.0 - (r.capacity_current::float / r.capacity_max::float))
             + 0.2 * $2
           ) AS score
    FROM recipients r
    WHERE ST_DWithin(r.location, $1, $3)
      AND $4 = ANY(r.accepted_food_types)
      AND r.capacity_current < r.capacity_max
      AND ($5::uuid[] IS NULL OR NOT (r.id = ANY($5::uuid[])))
    ORDER BY score DESC
    LIMIT 1
  `;

  const values = [
    donation.pickup_location,
    urgency,
    DEFAULT_RADIUS_METERS,
    donation.food_type,
    allExcludedIds.length > 0 ? allExcludedIds : null
  ];

  const candidateRes = await pool.query(query, values);

  if (candidateRes.rows.length === 0) {
    console.log(`[Matching] No eligible recipients found for donation ${donationId}`);
    // Clear any previous matched_recipient_id since no candidate is available
    await pool.query(
      `UPDATE donations SET matched_recipient_id = NULL WHERE id = $1 AND status = 'posted'`,
      [donationId]
    );
    activeOffers.delete(donationId);
    return { matched: false, reason: 'no_candidates' };
  }

  const bestCandidate = candidateRes.rows[0];
  console.log(`[Matching] Matched donation ${donationId} to recipient ${bestCandidate.org_name} (${bestCandidate.id}) with score ${bestCandidate.score.toFixed(4)}, distance ${bestCandidate.distance_km.toFixed(2)} km`);

  // 3. Set donation.matched_recipient_id, status STAYS 'posted' until recipient accepts
  await pool.query(
    `UPDATE donations SET matched_recipient_id = $1 WHERE id = $2`,
    [bestCandidate.id, donationId]
  );

  // Track offer in memory
  activeOffers.set(donationId, {
    recipientId: bestCandidate.id,
    offeredAt: Date.now(),
    score: parseFloat(bestCandidate.score),
    distance_km: parseFloat(bestCandidate.distance_km),
    excludedRecipientIds: allExcludedIds
  });

  // 4. Emit WebSocket event "offer:new" per ARCHITECTURE.md §6
  emitEvent('offer:new', {
    donationId,
    recipientId: bestCandidate.id,
    distance_km: parseFloat(bestCandidate.distance_km),
    food_type: donation.food_type,
    quantity: parseFloat(donation.quantity),
    unit: donation.unit,
    expiry_window_end: donation.expiry_window_end
  });

  // 5. Notify recipient (FR-7.1)
  notifyRecipientOffer(bestCandidate, donation).catch(err => {
    console.error('[Matching] Notification error:', err.message);
  });

  return {
    matched: true,
    recipient: bestCandidate,
    score: parseFloat(bestCandidate.score),
    distance_km: parseFloat(bestCandidate.distance_km)
  };
}

/**
 * Handle recipient rejecting an offer (FR-3.4)
 * Clears the offer, adds recipient to excluded list, and immediately re-runs matching.
 */
async function rejectOffer(donationId, recipientId) {
  const tracked = activeOffers.get(donationId);
  const excluded = new Set(tracked?.excludedRecipientIds || []);
  excluded.add(recipientId);

  // Clear current offer
  await pool.query(
    `UPDATE donations SET matched_recipient_id = NULL WHERE id = $1 AND matched_recipient_id = $2 AND status = 'posted'`,
    [donationId, recipientId]
  );

  // Update tracking
  activeOffers.set(donationId, {
    recipientId: null,
    offeredAt: null,
    excludedRecipientIds: Array.from(excluded)
  });

  console.log(`[Matching] Recipient ${recipientId} rejected donation ${donationId}. Cascading immediately...`);

  // Immediately re-run matching against remaining candidates (FR-3.4)
  return matchDonation(donationId, Array.from(excluded));
}

/**
 * Handle recipient accepting an offer (FR-3.3)
 * Sets status to 'matched', increments capacity_current, and triggers driver matching hook.
 */
async function acceptOffer(donationId, recipientId, preferredDriverId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify the donation is still open. The transaction makes the first acceptance win.
    const donRes = await client.query(
      `SELECT id, donor_id, weight_kg, quantity, status, expiry_window_end
       FROM donations
       WHERE id = $1 AND status = 'posted'
      `,
      [donationId]
    );

    if (donRes.rows.length === 0) {
      throw new Error('Offer not found or not matched to this recipient');
    }

    const donation = donRes.rows[0];

    await upsertDonationConnection({
      donationId,
      donorId: donation.donor_id,
      recipientId,
      driverId: null,
      status: 'matched'
    });

    // NFR-3 verification
    if (new Date(donation.expiry_window_end) <= new Date()) {
      await client.query(`UPDATE donations SET status = 'expired' WHERE id = $1`, [donationId]);
      await client.query('COMMIT');
      emitEvent('donation:status_changed', { donationId, status: 'expired', timestamp: new Date().toISOString() });
      throw new Error('Donation has expired and cannot be accepted');
    }

    if (donation.status !== 'posted') {
      throw new Error(`Cannot accept donation with status: ${donation.status}`);
    }

    // The first recipient to accept claims the donation.
    await client.query(
      `UPDATE donations SET status = 'matched', matched_recipient_id = $2 WHERE id = $1`,
      [donationId, recipientId]
    );

    // Increment recipient capacity_current (Task 3)
    const weightToAdd = parseFloat(donation.weight_kg) || parseFloat(donation.quantity) || 1;
    await client.query(
      `UPDATE recipients
       SET capacity_current = LEAST(capacity_max, capacity_current + $1)
       WHERE id = $2`,
      [weightToAdd, recipientId]
    );

    await client.query('COMMIT');

    // Remove from active offers tracking
    activeOffers.delete(donationId);

    const timestamp = new Date().toISOString();
    // Emit WebSocket "donation:status_changed" per ARCHITECTURE.md §6
    emitEvent('donation:status_changed', {
      donationId,
      status: 'matched',
      timestamp
    });

    console.log(`[Matching] Donation ${donationId} accepted by recipient ${recipientId}. Status is now 'matched'.`);

    // Task 1: On donation reaching 'matched' status, trigger driver assignment
    const { assignDriver } = require('./dispatch');
    const dispatchResult = await assignDriver(donationId, preferredDriverId);

    return {
      success: true,
      status: 'matched',
      donationId,
      driver: dispatchResult.driver || null
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Timeout Cascade Runner (FR-2.3 & Task 5)
 * Checks periodically for pending offers exceeding OFFER_TIMEOUT_SECONDS
 * and re-offers to the next-ranked candidate.
 * Also marks expired donations as 'expired' (FR-2.4).
 */
let cascadeIntervalId = null;

function startTimeoutCascade(checkIntervalMs = 5000, timeoutSeconds = OFFER_TIMEOUT_SECONDS) {
  if (cascadeIntervalId) {
    clearInterval(cascadeIntervalId);
  }

  console.log(`[Matching] Starting timeout cascade runner (check every ${checkIntervalMs}ms, timeout: ${timeoutSeconds}s)`);

  cascadeIntervalId = setInterval(async () => {
    try {
      const now = new Date();

      // 1. Check for donations whose expiry_window_end has passed while in 'posted' status
      const expiredRes = await pool.query(
        `UPDATE donations
         SET status = 'expired', matched_recipient_id = NULL
         WHERE status = 'posted' AND expiry_window_end <= $1
         RETURNING id`,
        [now.toISOString()]
      );

      for (const row of expiredRes.rows) {
        console.log(`[Matching] Donation ${row.id} expired due to expiry_window_end passed`);
        activeOffers.delete(row.id);
        emitEvent('donation:status_changed', {
          donationId: row.id,
          status: 'expired',
          timestamp: now.toISOString()
        });
      }

      // 2. Check for pending offers in activeOffers that have exceeded timeoutSeconds
      const nowTs = Date.now();
      for (const [donationId, offer] of activeOffers.entries()) {
        if (offer.offeredAt && (nowTs - offer.offeredAt) > timeoutSeconds * 1000) {
          console.log(`[Matching] Offer for donation ${donationId} to recipient ${offer.recipientId} timed out (${timeoutSeconds}s elapsed). Cascading to next candidate...`);
          
          const excluded = new Set(offer.excludedRecipientIds || []);
          if (offer.recipientId) excluded.add(offer.recipientId);

          // Clear current offer in DB
          await pool.query(
            `UPDATE donations SET matched_recipient_id = NULL WHERE id = $1 AND status = 'posted'`,
            [donationId]
          );

          // Re-offer to next candidate
          await matchDonation(donationId, Array.from(excluded));
        }
      }
    } catch (err) {
      console.error('[Matching] Error in timeout cascade runner:', err.message);
    }
  }, checkIntervalMs);

  return cascadeIntervalId;
}

function stopTimeoutCascade() {
  if (cascadeIntervalId) {
    clearInterval(cascadeIntervalId);
    cascadeIntervalId = null;
  }
}

function getActiveOffers() {
  return activeOffers;
}

module.exports = {
  matchDonation,
  rejectOffer,
  acceptOffer,
  startTimeoutCascade,
  stopTimeoutCascade,
  setSocketIo,
  getActiveOffers,
  DEFAULT_RADIUS_METERS,
  OFFER_TIMEOUT_SECONDS
};
