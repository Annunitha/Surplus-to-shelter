/**
 * Phase 1 DoD verification script
 * Tests: register donor, create donation, past expiry rejection, GET /mine
 */

const BASE = 'http://localhost:3000';

async function test() {
  console.log('=== Phase 1 DoD Verification ===\n');

  // 1. Register or login a test donor
  console.log('1. Registering/logging in test donor...');
  const testEmail = `phase1_${Date.now()}@test.com`;
  let res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'test1234',
      role: 'donor',
      org_name: 'Phase1 Test Restaurant',
      address_text: 'Connaught Place, New Delhi',
      lat: 28.6315,
      lng: 77.2167
    })
  });
  let auth = await res.json();
  if (!auth.token) {
    // Try login
    res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'phase1test@test.com', password: 'test1234' })
    });
    auth = await res.json();
  }
  console.log('   Authenticated:', auth.role, auth.profileId ? 'OK' : 'FAIL');
  const token = auth.token;

  // 2. Test past expiry_window_end rejection (NFR-3)
  console.log('\n2. Testing past expiry_window_end rejection...');
  res = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      food_description: 'Leftover pasta',
      food_type: 'prepared_meals',
      quantity: 10,
      unit: 'kg',
      pickup_address: 'Connaught Place, New Delhi',
      expiry_window_end: '2020-01-01T00:00:00Z'  // past date
    })
  });
  const rejectResult = await res.json();
  console.log('   Status:', res.status, '- Message:', rejectResult.error);
  console.log('   Past-date rejection:', res.status === 400 ? 'PASS ✅' : 'FAIL ❌');

  // 3. Create a valid donation (unit=kg)
  console.log('\n3. Creating valid donation (10 kg)...');
  const futureDate = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours from now
  res = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      food_description: 'Fresh sandwiches and wraps',
      food_type: 'prepared_meals',
      quantity: 10,
      unit: 'kg',
      pickup_address: 'Connaught Place, New Delhi',
      expiry_window_end: futureDate
    })
  });
  const donation1 = await res.json();
  console.log('   Status:', res.status);
  console.log('   Donation ID:', donation1.donation?.id);
  console.log('   weight_kg:', donation1.donation?.weight_kg, '(expected: 10)');
  console.log('   status:', donation1.donation?.status, '(expected: posted)');
  console.log('   Create donation:', res.status === 201 ? 'PASS ✅' : 'FAIL ❌');

  // 4. Create donation with lbs
  console.log('\n4. Creating donation (22 lbs → ~9.98 kg)...');
  res = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      food_description: 'Assorted bakery items',
      food_type: 'bakery',
      quantity: 22,
      unit: 'lbs',
      pickup_address: 'Chandni Chowk, Delhi',
      expiry_window_end: futureDate
    })
  });
  const donation2 = await res.json();
  console.log('   weight_kg:', donation2.donation?.weight_kg, '(expected: ~9.979)');
  console.log('   lbs conversion:', Math.abs(donation2.donation?.weight_kg - 9.979024) < 0.01 ? 'PASS ✅' : 'FAIL ❌');

  // 5. Create donation with servings
  console.log('\n5. Creating donation (50 servings → 20 kg)...');
  res = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      food_description: 'Rice and curry portions',
      food_type: 'prepared_meals',
      quantity: 50,
      unit: 'servings',
      pickup_address: 'India Gate, New Delhi',
      expiry_window_end: futureDate
    })
  });
  const donation3 = await res.json();
  console.log('   weight_kg:', donation3.donation?.weight_kg, '(expected: 20)');
  console.log('   servings conversion:', donation3.donation?.weight_kg === 20 ? 'PASS ✅' : 'FAIL ❌');

  // 6. GET /api/donations/mine
  console.log('\n6. Testing GET /api/donations/mine...');
  res = await fetch(`${BASE}/api/donations/mine`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const mineResult = await res.json();
  console.log('   Donations count:', mineResult.donations?.length, '(expected: 3)');
  console.log('   All posted:', mineResult.donations?.every(d => d.status === 'posted') ? 'PASS ✅' : 'FAIL ❌');
  console.log('   All have weight_kg:', mineResult.donations?.every(d => d.weight_kg != null) ? 'PASS ✅' : 'FAIL ❌');

  // 7. GET /api/donations/:id — check geocoded location
  console.log('\n7. Testing GET /api/donations/:id (geocoded location)...');
  const donationId = donation1.donation?.id;
  res = await fetch(`${BASE}/api/donations/${donationId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const detail = await res.json();
  console.log('   lat:', detail.donation?.lat, 'lng:', detail.donation?.lng);
  console.log('   Has geocoded location:', (detail.donation?.lat && detail.donation?.lng) ? 'PASS ✅' : 'FAIL ❌');

  console.log('\n=== Phase 1 DoD Verification Complete ===');
}

test().catch(e => console.error('Test error:', e));
