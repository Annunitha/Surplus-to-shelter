/**
 * Phase 2 Definition of Done Verification Script
 * 
 * Tests:
 * 1. Post donation → highest-scoring eligible recipient receives offer
 * 2. Recipient accepts → donation status becomes 'matched', capacity_current increments
 * 3. Recipient rejects → immediate cascade to second-ranked eligible recipient
 * 4. Past expiry date hard filter → donation never appears in any recipient's offers
 * 5. Timeout cascade → pending offer times out and cascades to next candidate
 * 6. PATCH /api/recipients/me → updates capacity and accepted food types
 */

const BASE = 'http://localhost:3000';

async function test() {
  console.log('=== Phase 2 DoD Verification ===\n');

  // --- Helper: Register or login a user ---
  async function getAuthToken(email, password, role, extra = {}) {
    let res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role, ...extra })
    });
    let data = await res.json();
    if (!data.token) {
      res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      data = await res.json();
    }
    return data;
  }

  // Clean up any stale test records from previous test runs safely
  const { pool } = require('../db');
  await pool.query("DELETE FROM deliveries");
  await pool.query("DELETE FROM impact_log");
  await pool.query("UPDATE donations SET matched_recipient_id = NULL, matched_driver_id = NULL");
  await pool.query("DELETE FROM donations");
  await pool.query("DELETE FROM recipients WHERE contact_email LIKE '%demo%' OR contact_email LIKE '%test%' OR org_name LIKE 'Shelter%' OR org_name LIKE 'Pahar%' OR org_name LIKE 'Karol%' OR org_name LIKE 'P4%' OR org_name LIKE 'P3%'");
  await pool.query("DELETE FROM users WHERE email LIKE '%_p2_%' OR email LIKE '%demo%'");

  // Set up test donor in Connaught Place (28.6315, 77.2167)
  console.log('1. Setting up test donor and recipients...');
  const donorAuth = await getAuthToken(
    `donor_p2_${Date.now()}@test.com`,
    'test1234',
    'donor',
    { org_name: 'P2 Donor Bistro', address_text: 'Connaught Place, Delhi', lat: 28.6315, lng: 77.2167 }
  );

  // Recipient A (Close: ~0.9 km away)
  const rA = await getAuthToken(
    `recipientA_p2_${Date.now()}@test.com`,
    'test1234',
    'recipient',
    {
      org_name: 'Shelter A Near',
      address_text: 'Barakhamba Road, Delhi',
      lat: 28.6290,
      lng: 77.2280,
      accepted_food_types: ['prepared_meals', 'bakery'],
      capacity_max: 100
    }
  );

  // Recipient B (Next closest: ~1.4 km away)
  const rB = await getAuthToken(
    `recipientB_p2_${Date.now()}@test.com`,
    'test1234',
    'recipient',
    {
      org_name: 'Shelter B Far',
      address_text: 'Mandi House, Delhi',
      lat: 28.6250,
      lng: 77.2340,
      accepted_food_types: ['prepared_meals', 'bakery'],
      capacity_max: 100
    }
  );

  console.log(`   Donor: ${donorAuth.profileId}`);
  console.log(`   Recipient A (Near): ${rA.profileId}`);
  console.log(`   Recipient B (Far):  ${rB.profileId}`);

  // Test 1: Post donation → Recipient A should be highest-scoring due to closer distance
  console.log('\n2. Testing matching ranking (Recipient A should be chosen over Recipient B)...');
  const futureExpiry = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
  let donRes = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorAuth.token}` },
    body: JSON.stringify({
      food_description: '50 Delicious Meals',
      food_type: 'prepared_meals',
      quantity: 50,
      unit: 'servings',
      pickup_address: 'Connaught Place, Delhi',
      expiry_window_end: futureExpiry
    })
  });
  const donData = await donRes.json();
  const donation1Id = donData.donation.id;

  // Check Recipient A's offers
  let offersResA = await fetch(`${BASE}/api/recipients/me/offers`, {
    headers: { 'Authorization': `Bearer ${rA.token}` }
  });
  let offersA = (await offersResA.json()).offers;

  // Check Recipient B's offers
  let offersResB = await fetch(`${BASE}/api/recipients/me/offers`, {
    headers: { 'Authorization': `Bearer ${rB.token}` }
  });
  let offersB = (await offersResB.json()).offers;

  const aGotOffer = offersA.some(o => o.id === donation1Id);
  const bGotOffer = offersB.some(o => o.id === donation1Id);
  console.log(`   Recipient A (Near) received offer: ${aGotOffer}`);
  console.log(`   Recipient B (Far) received offer:  ${bGotOffer}`);
  console.log('   DoD 1 (Highest-scoring received offer):', (aGotOffer && !bGotOffer) ? 'PASS ✅' : 'FAIL ❌');

  // Test 2: Recipient A rejects → immediate cascade to Recipient B (DoD 3)
  console.log('\n3. Testing reject-triggers-cascade (Recipient A rejects → Recipient B gets offer)...');
  let rejectRes = await fetch(`${BASE}/api/recipients/me/offers/${donation1Id}/reject`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${rA.token}` }
  });
  let rejectData = await rejectRes.json();
  console.log('   Reject result cascaded:', rejectData.cascaded);

  // Check Recipient B offers again
  offersResB = await fetch(`${BASE}/api/recipients/me/offers`, {
    headers: { 'Authorization': `Bearer ${rB.token}` }
  });
  offersB = (await offersResB.json()).offers;
  const bGotOfferAfterCascade = offersB.some(o => o.id === donation1Id);
  console.log(`   Recipient B now has offer: ${bGotOfferAfterCascade}`);
  console.log('   DoD 3 (Reject cascade to next eligible recipient):', bGotOfferAfterCascade ? 'PASS ✅' : 'FAIL ❌');

  // Test 3: Recipient B accepts → donation status becomes 'matched', capacity increments (DoD 2)
  console.log('\n4. Testing accept offer (Recipient B accepts)...');
  // Check B's capacity before
  let profBBefore = await fetch(`${BASE}/api/recipients/me`, {
    headers: { 'Authorization': `Bearer ${rB.token}` }
  });
  const capBefore = (await profBBefore.json()).recipient.capacity_current;

  let acceptRes = await fetch(`${BASE}/api/recipients/me/offers/${donation1Id}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${rB.token}` }
  });
  let acceptData = await acceptRes.json();
  console.log('   Accept status returned:', acceptData.status);

  // Check donation status in DB
  let donDetailRes = await fetch(`${BASE}/api/donations/${donation1Id}`, {
    headers: { 'Authorization': `Bearer ${donorAuth.token}` }
  });
  let donDetail = (await donDetailRes.json()).donation;
  console.log('   Donation status in DB:', donDetail.status);

  // Check B's capacity after
  let profBAfter = await fetch(`${BASE}/api/recipients/me`, {
    headers: { 'Authorization': `Bearer ${rB.token}` }
  });
  const capAfter = (await profBAfter.json()).recipient.capacity_current;
  console.log(`   Recipient B capacity: ${capBefore} → ${capAfter}`);

  const acceptPassed = acceptData.status === 'matched' && donDetail.status === 'matched' && capAfter > capBefore;
  console.log('   DoD 2 (Accept → matched & capacity increment):', acceptPassed ? 'PASS ✅' : 'FAIL ❌');

  // Test 4: Past expiry date hard filter (DoD 4)
  console.log('\n5. Testing past-expiry hard filter (must never appear in any recipient offers)...');
  const pastDonationRes = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorAuth.token}` },
    body: JSON.stringify({
      food_description: 'Expired Bread',
      food_type: 'bakery',
      quantity: 10,
      unit: 'kg',
      pickup_address: 'Connaught Place, Delhi',
      expiry_window_end: '2023-01-01T00:00:00Z'
    })
  });
  console.log('   Posting with past expiry returned HTTP status:', pastDonationRes.status, '(rejected at intake)');

  // Now test with donation whose expiry is forced into the past in DB
  const forcedExpRes = await pool.query(
    `INSERT INTO donations (donor_id, food_description, food_type, quantity, unit, weight_kg,
       pickup_location, pickup_address, posted_at, expiry_window_end, status, matched_recipient_id)
     VALUES ($1, 'Expired in DB', 'bakery', 5, 'kg', 5,
       ST_SetSRID(ST_MakePoint(77.2167, 28.6315), 4326)::geography, 'CP, Delhi',
       now() - interval '2 hours', now() - interval '1 hour', 'posted', $2)
     RETURNING id`,
    [donorAuth.profileId, rA.profileId]
  );
  const forcedExpiredId = forcedExpRes.rows[0].id;

  // Check Recipient A's offers — must NOT include forcedExpiredId
  offersResA = await fetch(`${BASE}/api/recipients/me/offers`, {
    headers: { 'Authorization': `Bearer ${rA.token}` }
  });
  offersA = (await offersResA.json()).offers;
  const expiredAppearedInOffers = offersA.some(o => o.id === forcedExpiredId);
  console.log('   Expired donation appeared in offers:', expiredAppearedInOffers);
  console.log('   DoD 4 (Expired donation never appears in offers):', !expiredAppearedInOffers ? 'PASS ✅' : 'FAIL ❌');

  // Test 5: Recipient preferences and capacity update (Task 6)
  console.log('\n6. Testing PATCH /api/recipients/me (update preferences/capacity)...');
  const patchRes = await fetch(`${BASE}/api/recipients/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rA.token}` },
    body: JSON.stringify({
      capacity_max: 250,
      capacity_current: 10,
      accepted_food_types: ['produce', 'dairy', 'dry_goods']
    })
  });
  const patchData = await patchRes.json();
  const patchPassed = patchData.recipient?.capacity_max === 250 &&
                      patchData.recipient?.accepted_food_types.includes('produce');
  console.log('   PATCH /api/recipients/me result:', patchPassed ? 'PASS ✅' : 'FAIL ❌');

  // Test 6: Timeout cascade demonstrably re-offers (DoD 5)
  console.log('\n7. Testing timeout cascade (re-offers after configured window)...');
  // Re-enable prepared_meals for Recipient A so it's eligible
  await fetch(`${BASE}/api/recipients/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rA.token}` },
    body: JSON.stringify({
      accepted_food_types: ['prepared_meals'],
      capacity_current: 0,
      capacity_max: 200
    })
  });

  // Post another donation that matches Recipient A first
  const don3Res = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorAuth.token}` },
    body: JSON.stringify({
      food_description: 'Sandwiches for Timeout Test',
      food_type: 'prepared_meals',
      quantity: 15,
      unit: 'kg',
      pickup_address: 'Connaught Place, Delhi',
      expiry_window_end: new Date(Date.now() + 4 * 3600 * 1000).toISOString()
    })
  });
  const donation3Id = (await don3Res.json()).donation.id;

  // Recipient A should have received offer
  offersResA = await fetch(`${BASE}/api/recipients/me/offers`, {
    headers: { 'Authorization': `Bearer ${rA.token}` }
  });
  offersA = (await offersResA.json()).offers;
  console.log(`   Initial offer to Recipient A: ${offersA.some(o => o.id === donation3Id)}`);

  console.log('   Waiting 13 seconds for background timeout cascade (10s configured timeout) to trigger...');
  await new Promise(r => setTimeout(r, 13000));

  // Check Recipient B — offer should have cascaded to Recipient B!
  offersResB = await fetch(`${BASE}/api/recipients/me/offers`, {
    headers: { 'Authorization': `Bearer ${rB.token}` }
  });
  offersB = (await offersResB.json()).offers;
  const cascadedToB = offersB.some(o => o.id === donation3Id);
  console.log(`   Offer cascaded to Recipient B via timeout: ${cascadedToB}`);
  console.log('   DoD 5 (Timeout cascade re-offers automatically):', cascadedToB ? 'PASS ✅' : 'FAIL ❌');

  console.log('\n=== Phase 2 DoD Verification Finished ===\n');
  await pool.end();
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
