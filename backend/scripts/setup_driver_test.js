/**
 * Quick setup: Creates a fresh donation matched to the driver for testing.
 * Uses direct DB + API like demo_scenario.js does.
 */
const { pool } = require('../db');
const BASE = 'http://localhost:3000';

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

async function main() {
  console.log('\n=== Setting up fresh driver assignment ===\n');

  // Make sure driver is available
  await pool.query("UPDATE drivers SET status = 'available' WHERE name LIKE 'Amit Kumar%'");

  // Login actors
  const donor = await getAuthToken('grand_bistro@demo.com', 'demo1234', 'donor', {
    org_name: 'The Connaught Grand Bistro',
    address_text: 'Connaught Place Inner Circle, Delhi',
    lat: 28.6315, lng: 77.2167
  });
  console.log('✅ Donor token obtained');

  const shelter = await getAuthToken('karolbagh_shelter@demo.com', 'demo1234', 'recipient', {
    org_name: 'Karol Bagh Relief Shelter',
    address_text: 'Arya Samaj Road, Karol Bagh, Delhi',
    lat: 28.6510, lng: 77.1910,
    accepted_food_types: ['prepared_meals', 'produce'],
    capacity_max: 300
  });
  console.log('✅ Shelter token obtained');

  // Reset shelter capacity
  await pool.query("UPDATE recipients SET capacity_current = 0 WHERE id = $1", [shelter.profileId]);

  // Max out other recipients
  await pool.query("UPDATE recipients SET capacity_current = capacity_max WHERE id != $1", [shelter.profileId]);

  const driverData = await getAuthToken('amit_driver@demo.com', 'demo1234', 'driver', {
    name: 'Amit Kumar (Express Volunteer)',
    contact_phone: '+91 98765 43210',
    lat: 28.6320, lng: 77.2170
  });
  console.log('✅ Driver token obtained');

  // Post donation
  const expiryTime = new Date(Date.now() + 90 * 60 * 1000).toISOString();
  let res = await fetch(`${BASE}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donor.token}` },
    body: JSON.stringify({
      food_description: 'Fresh Paneer Tikka & Butter Naan Platters',
      food_type: 'prepared_meals',
      quantity: 25,
      unit: 'kg',
      weight_kg: 30,
      pickup_address: 'Connaught Place Inner Circle, New Delhi',
      pickup_lat: 28.6315,
      pickup_lng: 77.2167,
      expiry_window_end: expiryTime
    })
  });
  const donData = await res.json();
  const donationId = donData.donation?.id;
  console.log('✅ Donation posted:', donationId);

  // Wait for matching
  console.log('⏳ Waiting for matching engine...');
  await new Promise(r => setTimeout(r, 2500));

  // Check for offers
  res = await fetch(`${BASE}/api/recipients/me/offers`, {
    headers: { Authorization: `Bearer ${shelter.token}` }
  });
  const offersData = await res.json();
  const pendingOffer = offersData.offers?.find(o => o.status === 'posted');
  
  if (pendingOffer) {
    // Accept offer
    res = await fetch(`${BASE}/api/recipients/me/offers/${pendingOffer.id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${shelter.token}` }
    });
    const acceptData = await res.json();
    console.log('✅ Shelter accepted:', acceptData.message);
  } else {
    console.log('⚠️  No pending offer found for shelter. Offers:', offersData.offers?.length || 0);
  }

  // Wait for driver dispatch  
  await new Promise(r => setTimeout(r, 1500));

  // Check driver assignment
  res = await fetch(`${BASE}/api/drivers/me/assignment`, {
    headers: { Authorization: `Bearer ${driverData.token}` }
  });
  const assignmentData = await res.json();

  if (assignmentData.assignment) {
    console.log('\n✅ Driver has active assignment!');
    console.log('   Donation ID:', assignmentData.assignment.donation_id);
    console.log('   Status:', assignmentData.assignment.status);
    console.log('   Food:', assignmentData.assignment.food_description);
    console.log('   Pickup:', assignmentData.assignment.pickup?.org_name);
    console.log('   Dropoff:', assignmentData.assignment.dropoff?.org_name);
    console.log('   Expires:', assignmentData.assignment.expires_in_seconds, 'seconds');
  } else {
    console.log('\n⚠️  No active assignment. Checking donation status...');
    const donCheck = await pool.query('SELECT status, matched_driver_id, matched_recipient_id FROM donations WHERE id = $1', [donationId]);
    if (donCheck.rows.length) {
      console.log('   Donation status:', donCheck.rows[0].status);
      console.log('   Matched driver:', donCheck.rows[0].matched_driver_id);
      console.log('   Matched recipient:', donCheck.rows[0].matched_recipient_id);
    }
  }

  console.log('\n=== Ready for manual testing at http://localhost:5173/driver ===\n');
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
