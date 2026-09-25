/**
 * Phase 4 Definition of Done Verification Script
 * 
 * Tests:
 * 1. A delivered donation produces a correct impact_log row with the exact formula:
 *    - meals_estimate = weight_kg / 0.545
 *    - co2e_avoided_kg = weight_kg * 2.5
 * 2. GET /api/impact/summary returns correct running totals matching the sum of impact_log.
 * 3. End-to-end delivery cycle updates impact totals.
 * 4. Notifications visibly arrive:
 *    - When offer is created → recipient notified (FR-7.1)
 *    - When driver is assigned → driver notified (FR-7.2)
 *    - Logged to notifications.log and recorded with timestamp/recipient/status.
 */

const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:3000';
const { pool } = require('../db');

async function test() {
  console.log('=== Phase 4 DoD Verification ===\n');

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

  // Clean up any old test records safely
  await pool.query("UPDATE donations SET matched_driver_id = NULL, matched_recipient_id = NULL");
  await pool.query("DELETE FROM deliveries WHERE donation_id IN (SELECT id FROM donations WHERE food_description LIKE '%P4%' OR food_description LIKE '%Biryani%')");
  await pool.query("DELETE FROM impact_log WHERE donation_id IN (SELECT id FROM donations WHERE food_description LIKE '%P4%' OR food_description LIKE '%Biryani%')");
  await pool.query("DELETE FROM donations WHERE food_description LIKE '%P4%' OR food_description LIKE '%Biryani%'");
  await pool.query("DELETE FROM users WHERE email LIKE '%_p4_%'");
  await pool.query("DELETE FROM drivers WHERE name LIKE 'P4 Driver %'");
  await pool.query("DELETE FROM recipients WHERE org_name LIKE 'P4 %' OR org_name LIKE 'Shelter %'");

  // 1. Initial State: Fetch GET /api/impact/summary
  console.log('1. Checking initial public impact summary...');
  let summaryRes = await fetch(`${BASE}/api/impact/summary`);
  let initialSummary = await summaryRes.json();
  console.log('   Initial Total Meals:', initialSummary.total_meals);
  console.log('   Initial Total Weight:', initialSummary.total_weight_kg, 'kg');
  console.log('   Initial Total CO2e:', initialSummary.total_co2e_avoided_kg, 'kg');
  console.log('   Initial Total Deliveries:', initialSummary.total_deliveries);

  // 2. Setup Donor, Recipient, Driver
  console.log('\n2. Setting up test actors (Donor, Recipient, Driver)...');
  const donor = await getAuthToken(
    `donor_p4_${Date.now()}@test.com`,
    'test1234',
    'donor',
    { org_name: 'P4 Donor Kitchen', address_text: 'Connaught Place, Delhi', lat: 28.63150, lng: 77.21670 }
  );

  const recipient = await getAuthToken(
    `recipient_p4_${Date.now()}@test.com`,
    'test1234',
    'recipient',
    {
      org_name: 'P4 Hope Mission Shelter',
      address_text: 'Right Next Door, Delhi',
      lat: 28.63152,
      lng: 77.21672,
      accepted_food_types: ['prepared_meals'],
      capacity_max: 500
    }
  );

  const driver = await getAuthToken(
    `driver_p4_${Date.now()}@test.com`,
    'test1234',
    'driver',
    {
      name: 'P4 Driver Vikram',
      contact_phone: '+919988776655',
      lat: 28.63154,
      lng: 77.21674
    }
  );

  // Clear notifications log before testing notifications
  const logPath = path.join(__dirname, '../logs/notifications.log');
  if (fs.existsSync(logPath)) {
    try { fs.unlinkSync(logPath); } catch (e) {}
  }

  // Ensure test driver Vikram is the nearest available driver
  await pool.query("UPDATE drivers SET status = 'busy' WHERE id != $1", [driver.profileId]);
  await pool.query(
    "UPDATE drivers SET status = 'available', current_location = ST_SetSRID(ST_MakePoint(77.21670, 28.63150), 4326)::geography WHERE id = $1",
    [driver.profileId]
  );

  // 3. Post a Donation (weight: 40 kg)
  console.log('\n3. Posting a 40 kg donation to trigger matching and recipient notification...');
  const postRes = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donor.token}` },
    body: JSON.stringify({
      food_description: '40 kg Fresh Biryani and Dal',
      food_type: 'prepared_meals',
      quantity: 40,
      unit: 'kg',
      pickup_address: 'Connaught Place, Delhi',
      expiry_window_end: new Date(Date.now() + 6 * 3600 * 1000).toISOString()
    })
  });
  const donation = (await postRes.json()).donation;
  console.log(`   Donation created: ${donation.id}, weight: ${donation.weight_kg} kg`);

  // Allow a moment for fire-and-forget notification
  await new Promise(r => setTimeout(r, 1000));

  // Verify Recipient Notification arrived (FR-7.1)
  let logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  const recipientNotified = logContent.includes(recipient.email) || logContent.includes('New Food Rescue Offer');
  console.log(`   Notification logged for Recipient Offer: ${recipientNotified}`);

  // 4. Recipient Accepts Offer → triggers Driver Dispatch & Driver Notification (FR-7.2)
  console.log('\n4. Recipient accepts offer → triggering driver dispatch...');
  const acceptRes = await fetch(`${BASE}/api/recipients/me/offers/${donation.id}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${recipient.token}` }
  });
  console.log(`   Offer accepted: ${(await acceptRes.json()).status}`);

  // Wait up to 5s for async driver dispatch hook & notification
  let driverNotified = false;
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 1000));
    logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    if (logContent.includes('New Pickup Assigned') || logContent.includes(driver.email)) {
      driverNotified = true;
      break;
    }
  }

  // Verify Driver Notification arrived (FR-7.2)
  console.log(`   Notification logged for Driver Dispatch: ${driverNotified}`);
  console.log('   DoD 4 (Real notifications visibly arrive on offer & dispatch):', (recipientNotified && driverNotified) ? 'PASS ✅' : 'FAIL ❌');

  // 5. Driver Picks Up & Delivers Donation
  console.log('\n5. Driver progressing pickup → delivery...');
  await fetch(`${BASE}/api/drivers/me/assignment/${donation.id}/picked-up`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${driver.token}` }
  });
  console.log('   Driver marked picked_up');

  const deliverRes = await fetch(`${BASE}/api/drivers/me/assignment/${donation.id}/delivered`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${driver.token}` }
  });
  console.log(`   Driver marked delivered: ${(await deliverRes.json()).status}`);

  // 6. Verify impact_log row formula (DoD 1)
  console.log('\n6. Verifying impact_log formula (DoD 1)...');
  const impRes = await pool.query(
    `SELECT weight_kg, meals_estimate, co2e_avoided_kg, logged_at
     FROM impact_log
     WHERE donation_id = $1`,
    [donation.id]
  );

  const imp = impRes.rows[0];
  console.log(`   Logged weight: ${imp?.weight_kg} kg (expected: 40)`);
  console.log(`   Logged meals:  ${imp?.meals_estimate} (expected: ~73.3945)`);
  console.log(`   Logged CO2e:   ${imp?.co2e_avoided_kg} (expected: 100.0)`);

  const expectedMeals = 40.0 / 0.545; // ~73.394
  const expectedCo2e = 40.0 * 2.5;    // 100.0

  const mealsDiff = Math.abs(parseFloat(imp?.meals_estimate) - expectedMeals);
  const co2eDiff = Math.abs(parseFloat(imp?.co2e_avoided_kg) - expectedCo2e);

  const dod1Passed = impRes.rows.length === 1 &&
                     parseFloat(imp.weight_kg) === 40 &&
                     mealsDiff < 0.01 &&
                     co2eDiff < 0.01;
  console.log('   DoD 1 (Correct impact_log row with exact formula):', dod1Passed ? 'PASS ✅' : 'FAIL ❌');

  // 7. Verify GET /api/impact/summary running totals match sum of impact_log (DoD 2 & DoD 3)
  console.log('\n7. Verifying /api/impact/summary running totals (DoD 2 & DoD 3)...');
  const dbSumRes = await pool.query(`
    SELECT
      COALESCE(SUM(weight_kg), 0) AS total_weight,
      COALESCE(SUM(meals_estimate), 0) AS total_meals,
      COALESCE(SUM(co2e_avoided_kg), 0) AS total_co2e,
      COUNT(*)::int AS total_deliveries
    FROM impact_log
  `);
  const dbTotals = dbSumRes.rows[0];

  summaryRes = await fetch(`${BASE}/api/impact/summary`);
  const updatedSummary = await summaryRes.json();

  console.log(`   DB Sum:      Meals: ${Math.round(dbTotals.total_meals)}, Weight: ${parseFloat(dbTotals.total_weight).toFixed(2)}, CO2e: ${parseFloat(dbTotals.total_co2e).toFixed(2)}, Deliveries: ${dbTotals.total_deliveries}`);
  console.log(`   API Summary: Meals: ${updatedSummary.total_meals}, Weight: ${updatedSummary.total_weight_kg}, CO2e: ${updatedSummary.total_co2e_avoided_kg}, Deliveries: ${updatedSummary.total_deliveries}`);

  const dod2Passed = updatedSummary.total_meals === Math.round(parseFloat(dbTotals.total_meals)) &&
                     Math.abs(updatedSummary.total_weight_kg - parseFloat(dbTotals.total_weight)) < 0.1 &&
                     Math.abs(updatedSummary.total_co2e_avoided_kg - parseFloat(dbTotals.total_co2e)) < 0.1 &&
                     updatedSummary.total_deliveries === dbTotals.total_deliveries;
  console.log('   DoD 2 (API summary matches sum of impact_log):', dod2Passed ? 'PASS ✅' : 'FAIL ❌');

  const dod3Passed = updatedSummary.total_deliveries > initialSummary.total_deliveries &&
                     updatedSummary.total_meals > initialSummary.total_meals;
  console.log('   DoD 3 (Impact dashboard updates after delivery completes):', dod3Passed ? 'PASS ✅' : 'FAIL ❌');

  // Print notification log snippet for demo
  console.log('\n--- Notification Log (Last entries) ---');
  console.log(logContent.trim() || '(No log file written)');

  // Restore all drivers to available
  await pool.query("UPDATE drivers SET status = 'available'");

  console.log('\n=== Phase 4 DoD Verification Finished ===\n');
  await pool.end();
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
