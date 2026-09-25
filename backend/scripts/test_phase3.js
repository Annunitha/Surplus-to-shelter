/**
 * Phase 3 Definition of Done Verification Script
 * 
 * Tests:
 * 1. A matched donation with an available driver gets assigned within seconds.
 * 2. Driver API shows pickup + dropoff info and expiry countdown.
 * 3. Driver progresses matched → picked_up → delivered with strict step enforcement:
 *    - Direct matched → delivered rejected (Do Not rule 1)
 *    - matched → picked_up succeeds, deliveries.actual_pickup_time set
 *    - picked_up → delivered succeeds, deliveries.actual_delivery_time set, driver available
 * 4. deliveries table populated with correct timestamps at each step.
 * 5. Donation with no available driver stays in 'matched' awaiting driver without erroring/expiring.
 * 6. Impact log created upon delivery (prepping for Phase 4).
 */

const BASE = 'http://localhost:3000';
const { pool } = require('../db');

async function test() {
  console.log('=== Phase 3 DoD Verification ===\n');

  // Clean up previous test records safely
  await pool.query("UPDATE donations SET matched_driver_id = NULL, matched_recipient_id = NULL");
  await pool.query("DELETE FROM deliveries");
  await pool.query("DELETE FROM impact_log");
  await pool.query("DELETE FROM donations");
  await pool.query("DELETE FROM users WHERE email LIKE '%_p3_%' OR email LIKE '%demo%'");
  await pool.query("DELETE FROM drivers WHERE name LIKE 'P3 Driver %' OR name LIKE 'Amit Kumar%'");
  await pool.query("DELETE FROM recipients WHERE org_name LIKE 'P3 Shelter %' OR org_name LIKE 'Pahar%' OR org_name LIKE 'Karol%'");
  await pool.query("DELETE FROM donors WHERE org_name LIKE 'P3 Donor %' OR org_name LIKE 'The Connaught%'");

  // Helper: Register or login
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

  // 1. Setup Donor, Recipient, Driver
  console.log('1. Setting up entities (Donor, Recipient, Driver)...');
  const donor = await getAuthToken(
    `donor_p3_${Date.now()}@test.com`,
    'test1234',
    'donor',
    { org_name: 'P3 Donor Bakery', address_text: 'Connaught Place, Delhi', lat: 28.6315, lng: 77.2167 }
  );

  const recipient = await getAuthToken(
    `recipient_p3_${Date.now()}@test.com`,
    'test1234',
    'recipient',
    {
      org_name: 'P3 Shelter Relief',
      address_text: 'Pahar Ganj, Delhi',
      lat: 28.6410,
      lng: 77.2140,
      accepted_food_types: ['bakery', 'prepared_meals'],
      capacity_max: 100
    }
  );

  // Driver A: Available, located nearby (CP area: 28.6300, 77.2180)
  const driverA = await getAuthToken(
    `driverA_p3_${Date.now()}@test.com`,
    'test1234',
    'driver',
    {
      name: 'P3 Driver Amit',
      contact_phone: '+919876543210',
      lat: 28.6300,
      lng: 77.2180
    }
  );

  console.log(`   Donor ID:     ${donor.profileId}`);
  console.log(`   Recipient ID: ${recipient.profileId}`);
  console.log(`   Driver A ID:  ${driverA.profileId}`);

  // 2. Post a donation and have recipient accept it
  console.log('\n2. Posting donation & recipient accepting...');
  const donRes = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donor.token}` },
    body: JSON.stringify({
      food_description: 'P3 Fresh Bread Loaves',
      food_type: 'bakery',
      quantity: 20,
      unit: 'kg',
      pickup_address: 'Connaught Place, Delhi',
      expiry_window_end: new Date(Date.now() + 5 * 3600 * 1000).toISOString()
    })
  });
  const donation1 = (await donRes.json()).donation;
  console.log(`   Donation created: ${donation1.id}`);

  // Recipient accepts offer → triggers driver dispatch (FR-3.3 & Task 1)
  const acceptRes = await fetch(`${BASE}/api/recipients/me/offers/${donation1.id}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${recipient.token}` }
  });
  const acceptData = await acceptRes.json();
  console.log(`   Offer accepted: ${acceptData.status}`);

  // Give brief moment (2.5s) for async driver dispatch hook across cloud pooler
  await new Promise(r => setTimeout(r, 2500));

  // 3. Verify Driver A received assignment (DoD 1)
  console.log('\n3. Verifying driver assignment (DoD 1)...');
  const assignRes = await fetch(`${BASE}/api/drivers/me/assignment`, {
    headers: { 'Authorization': `Bearer ${driverA.token}` }
  });
  const assignData = await assignRes.json();
  const assignment = assignData.assignment;

  console.log(`   Assignment exists: ${Boolean(assignment)}`);
  console.log(`   Assigned Donation ID: ${assignment?.donation_id}`);
  console.log(`   Pickup Address: ${assignment?.pickup?.address}`);
  console.log(`   Dropoff Address: ${assignment?.dropoff?.address}`);
  console.log(`   Expiry countdown (seconds): ${assignment?.expires_in_seconds}`);

  // Check driver status in DB (should be 'en_route')
  const driverCheck = await pool.query(`SELECT status FROM drivers WHERE id = $1`, [driverA.profileId]);
  console.log(`   Driver status in DB: ${driverCheck.rows[0]?.status} (expected: en_route)`);

  const dod1Passed = assignment?.donation_id === donation1.id &&
                     driverCheck.rows[0]?.status === 'en_route';
  console.log('   DoD 1 (Matched donation assigned to available driver):', dod1Passed ? 'PASS ✅' : 'FAIL ❌');

  // DoD 2: Driver UI shows pickup + dropoff info and expiry countdown
  const dod2Passed = Boolean(assignment?.pickup?.address && assignment?.dropoff?.address && assignment?.expires_in_seconds > 0);
  console.log('   DoD 2 (Driver shows pickup + dropoff info & countdown):', dod2Passed ? 'PASS ✅' : 'FAIL ❌');

  // 4. Test state machine strictness (Do Not rule 1): Cannot skip matched → delivered directly
  console.log('\n4. Testing state machine guard (matched → delivered directly must fail)...');
  const invalidDeliveredRes = await fetch(`${BASE}/api/drivers/me/assignment/${donation1.id}/delivered`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${driverA.token}` }
  });
  console.log(`   Invalid skip delivered HTTP status: ${invalidDeliveredRes.status} (expected: 400)`);
  const invalidMsg = (await invalidDeliveredRes.json()).error;
  console.log(`   Error message: "${invalidMsg}"`);
  console.log('   Skip guard (matched → delivered rejected):', invalidDeliveredRes.status === 400 ? 'PASS ✅' : 'FAIL ❌');

  // 5. Driver marks picked_up (Task 4)
  console.log('\n5. Driver marking picked_up...');
  const pickupRes = await fetch(`${BASE}/api/drivers/me/assignment/${donation1.id}/picked-up`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${driverA.token}` }
  });
  const pickupData = await pickupRes.json();
  console.log(`   Picked up response status: ${pickupData.status}`);

  // Check delivery table for actual_pickup_time
  const delCheck1 = await pool.query(
    `SELECT actual_pickup_time, actual_delivery_time FROM deliveries WHERE donation_id = $1`,
    [donation1.id]
  );
  const actualPickup = delCheck1.rows[0]?.actual_pickup_time;
  console.log(`   deliveries.actual_pickup_time in DB: ${actualPickup}`);
  const pickedUpPassed = pickupData.status === 'picked_up' && Boolean(actualPickup);
  console.log('   Status progression (matched → picked_up):', pickedUpPassed ? 'PASS ✅' : 'FAIL ❌');

  // 6. Driver marks delivered (Task 5)
  console.log('\n6. Driver marking delivered...');
  const deliverRes = await fetch(`${BASE}/api/drivers/me/assignment/${donation1.id}/delivered`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${driverA.token}` }
  });
  const deliverData = await deliverRes.json();
  console.log(`   Delivered response status: ${deliverData.status}`);

  // Check delivery table for actual_delivery_time
  const delCheck2 = await pool.query(
    `SELECT actual_delivery_time FROM deliveries WHERE donation_id = $1`,
    [donation1.id]
  );
  const actualDelivery = delCheck2.rows[0]?.actual_delivery_time;
  console.log(`   deliveries.actual_delivery_time in DB: ${actualDelivery}`);

  // Check driver status back to available
  const driverCheck2 = await pool.query(`SELECT status FROM drivers WHERE id = $1`, [driverA.profileId]);
  console.log(`   Driver status in DB after delivery: ${driverCheck2.rows[0]?.status} (expected: available)`);

  // Check impact log created
  const impactCheck = await pool.query(`SELECT * FROM impact_log WHERE donation_id = $1`, [donation1.id]);
  console.log(`   impact_log row count: ${impactCheck.rows.length}`);
  if (impactCheck.rows.length > 0) {
    const imp = impactCheck.rows[0];
    console.log(`   Logged impact: ${imp.weight_kg} kg, ~${parseFloat(imp.meals_estimate).toFixed(1)} meals, ~${parseFloat(imp.co2e_avoided_kg).toFixed(1)} kg CO2e`);
  }

  const dod3Passed = deliverData.status === 'delivered' && Boolean(actualDelivery) && driverCheck2.rows[0]?.status === 'available';
  console.log('   DoD 3 (Driver progressed matched → picked_up → delivered):', dod3Passed ? 'PASS ✅' : 'FAIL ❌');
  console.log('   DoD 4 (deliveries table timestamps populated):', (Boolean(actualPickup) && Boolean(actualDelivery)) ? 'PASS ✅' : 'FAIL ❌');

  // 7. Test "Awaiting Driver" state when NO driver is available (DoD 5 & FR-4.4)
  console.log('\n7. Testing "Awaiting Driver" state (all drivers busy)...');
  // Temporarily set all drivers to 'busy'
  await pool.query(`UPDATE drivers SET status = 'busy'`);

  // Post second donation
  const don2Res = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donor.token}` },
    body: JSON.stringify({
      food_description: 'P3 Awaiting Driver Bread',
      food_type: 'bakery',
      quantity: 10,
      unit: 'kg',
      pickup_address: 'Connaught Place, Delhi',
      expiry_window_end: new Date(Date.now() + 4 * 3600 * 1000).toISOString()
    })
  });
  const donation2 = (await don2Res.json()).donation;

  // Recipient accepts second donation
  await fetch(`${BASE}/api/recipients/me/offers/${donation2.id}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${recipient.token}` }
  });

  await new Promise(r => setTimeout(r, 1000));

  // Check donation2 in DB: status MUST remain 'matched' and matched_driver_id MUST be NULL
  const don2DetailRes = await fetch(`${BASE}/api/donations/${donation2.id}`, {
    headers: { 'Authorization': `Bearer ${donor.token}` }
  });
  const don2Detail = (await don2DetailRes.json()).donation;
  console.log(`   Donation 2 status: ${don2Detail.status} (expected: matched)`);
  console.log(`   matched_driver_id: ${don2Detail.matched_driver_id} (expected: null)`);

  const awaitingPassed = don2Detail.status === 'matched' && !don2Detail.matched_driver_id;
  console.log('   DoD 5 (Stays in awaiting driver without erroring/expiring):', awaitingPassed ? 'PASS ✅' : 'FAIL ❌');

  // Restore Driver A to available and verify auto-assignment to awaiting donation
  console.log('\n8. Setting Driver A back to available (verifying auto-assignment)...');
  await fetch(`${BASE}/api/drivers/me/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverA.token}` },
    body: JSON.stringify({ status: 'available' })
  });

  await new Promise(r => setTimeout(r, 2000));

  const don2AfterRes = await fetch(`${BASE}/api/donations/${donation2.id}`, {
    headers: { 'Authorization': `Bearer ${donor.token}` }
  });
  const don2After = (await don2AfterRes.json()).donation;
  console.log(`   Donation 2 matched_driver_id after driver became available: ${don2After.matched_driver_id}`);
  console.log('   Auto-assignment on driver availability:', don2After.matched_driver_id === driverA.profileId ? 'PASS ✅' : 'FAIL ❌');

  // Restore any remaining drivers
  await pool.query(`UPDATE drivers SET status = 'available'`);

  console.log('\n=== Phase 3 DoD Verification Complete ===\n');
  await pool.end();
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
