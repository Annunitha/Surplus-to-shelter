/**
 * Seed script for Surplus-to-Shelter
 * 
 * Pulls real-world coordinates from OpenStreetMap Overpass API:
 * - ~15-20 restaurant coordinates as donors
 * - ~8-10 food bank/shelter coordinates as recipients
 * - Inserts 5-6 drivers with status 'available'
 * 
 * Demo city: Delhi, India (adjustable via DEMO_CITY env var)
 */

const { pool } = require('../db');

// Demo city bounding box — Delhi, India
const DEMO_CITY = {
  name: 'Delhi',
  south: 28.50,
  west: 77.10,
  north: 28.75,
  east: 77.35
};

const FOOD_TYPES = ['prepared_meals', 'produce', 'bakery', 'dairy', 'dry_goods', 'other'];

async function queryOverpass(query) {
  const url = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`
  });
  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchRestaurants() {
  const { south, west, north, east } = DEMO_CITY;
  const query = `
    [out:json][timeout:25];
    node["amenity"="restaurant"](${south},${west},${north},${east});
    out body 20;
  `;
  console.log('Fetching restaurants from Overpass API...');
  const data = await queryOverpass(query);
  return data.elements.slice(0, 20).map((el, i) => ({
    org_name: el.tags?.name || `Restaurant ${i + 1}`,
    contact_email: `donor${i + 1}@demo.surplus2shelter.org`,
    contact_phone: `+91900000${String(i + 1).padStart(4, '0')}`,
    lat: el.lat,
    lng: el.lon,
    address_text: el.tags?.['addr:full'] || el.tags?.['addr:street'] || `${DEMO_CITY.name} Restaurant Location ${i + 1}`
  }));
}

async function fetchShelters() {
  const { south, west, north, east } = DEMO_CITY;
  // Try food_bank first, fall back to social_facility
  const query = `
    [out:json][timeout:25];
    (
      node["social_facility"="food_bank"](${south},${west},${north},${east});
      node["amenity"="social_facility"](${south},${west},${north},${east});
      node["office"="ngo"](${south},${west},${north},${east});
      node["amenity"="community_centre"](${south},${west},${north},${east});
    );
    out body 15;
  `;
  console.log('Fetching shelters/food banks from Overpass API...');
  const data = await queryOverpass(query);
  
  let shelters = data.elements.slice(0, 10).map((el, i) => ({
    org_name: el.tags?.name || `Shelter ${i + 1}`,
    contact_email: `recipient${i + 1}@demo.surplus2shelter.org`,
    contact_phone: `+91800000${String(i + 1).padStart(4, '0')}`,
    lat: el.lat,
    lng: el.lon,
    address_text: el.tags?.['addr:full'] || el.tags?.['addr:street'] || `${DEMO_CITY.name} Shelter Location ${i + 1}`,
    accepted_food_types: getRandomFoodTypes(),
    capacity_max: Math.floor(Math.random() * 200) + 50
  }));

  // If we didn't get enough from Overpass, generate synthetic ones within the bounding box
  while (shelters.length < 8) {
    const i = shelters.length;
    shelters.push({
      org_name: `Food Bank ${i + 1}`,
      contact_email: `recipient${i + 1}@demo.surplus2shelter.org`,
      contact_phone: `+91800000${String(i + 1).padStart(4, '0')}`,
      lat: DEMO_CITY.south + Math.random() * (DEMO_CITY.north - DEMO_CITY.south),
      lng: DEMO_CITY.west + Math.random() * (DEMO_CITY.east - DEMO_CITY.west),
      address_text: `${DEMO_CITY.name} Food Bank Location ${i + 1}`,
      accepted_food_types: getRandomFoodTypes(),
      capacity_max: Math.floor(Math.random() * 200) + 50
    });
  }

  return shelters;
}

function getRandomFoodTypes() {
  // Each recipient accepts 2-5 random food types
  const count = Math.floor(Math.random() * 4) + 2;
  const shuffled = [...FOOD_TYPES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateDrivers() {
  const drivers = [];
  for (let i = 1; i <= 6; i++) {
    drivers.push({
      name: `Driver ${i}`,
      contact_phone: `+91700000${String(i).padStart(4, '0')}`,
      lat: DEMO_CITY.south + Math.random() * (DEMO_CITY.north - DEMO_CITY.south),
      lng: DEMO_CITY.west + Math.random() * (DEMO_CITY.east - DEMO_CITY.west)
    });
  }
  return drivers;
}

async function seed() {
  console.log('=== Surplus-to-Shelter Seed Script ===\n');

  try {
    // Schema is run separately via: node scripts/run_schema.js
    // This script only handles data seeding.

    // Clear existing seed data
    console.log('Clearing existing data...');
    await pool.query('DELETE FROM impact_log');
    await pool.query('DELETE FROM deliveries');
    await pool.query('DELETE FROM donations');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM drivers');
    await pool.query('DELETE FROM recipients');
    await pool.query('DELETE FROM donors');
    console.log('Existing data cleared.\n');

    // Seed donors
    let restaurants;
    try {
      restaurants = await fetchRestaurants();
      console.log(`Fetched ${restaurants.length} restaurants from Overpass API.`);
    } catch (err) {
      console.warn('Overpass API failed for restaurants, generating synthetic data:', err.message);
      restaurants = [];
      for (let i = 1; i <= 18; i++) {
        restaurants.push({
          org_name: `Restaurant ${i}`,
          contact_email: `donor${i}@demo.surplus2shelter.org`,
          contact_phone: `+91900000${String(i).padStart(4, '0')}`,
          lat: DEMO_CITY.south + Math.random() * (DEMO_CITY.north - DEMO_CITY.south),
          lng: DEMO_CITY.west + Math.random() * (DEMO_CITY.east - DEMO_CITY.west),
          address_text: `${DEMO_CITY.name} Restaurant Location ${i}`
        });
      }
    }

    for (const donor of restaurants) {
      await pool.query(
        `INSERT INTO donors (org_name, contact_email, contact_phone, location, address_text)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6)`,
        [donor.org_name, donor.contact_email, donor.contact_phone, donor.lng, donor.lat, donor.address_text]
      );
    }
    console.log(`Inserted ${restaurants.length} donors.\n`);

    // Seed recipients
    let shelters;
    try {
      shelters = await fetchShelters();
      console.log(`Fetched/generated ${shelters.length} shelters.`);
    } catch (err) {
      console.warn('Overpass API failed for shelters, generating synthetic data:', err.message);
      shelters = [];
      for (let i = 1; i <= 10; i++) {
        shelters.push({
          org_name: `Food Bank ${i}`,
          contact_email: `recipient${i}@demo.surplus2shelter.org`,
          contact_phone: `+91800000${String(i).padStart(4, '0')}`,
          lat: DEMO_CITY.south + Math.random() * (DEMO_CITY.north - DEMO_CITY.south),
          lng: DEMO_CITY.west + Math.random() * (DEMO_CITY.east - DEMO_CITY.west),
          address_text: `${DEMO_CITY.name} Food Bank Location ${i}`,
          accepted_food_types: getRandomFoodTypes(),
          capacity_max: Math.floor(Math.random() * 200) + 50
        });
      }
    }

    for (const shelter of shelters) {
      await pool.query(
        `INSERT INTO recipients (org_name, contact_email, contact_phone, location, address_text, accepted_food_types, capacity_max)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8)`,
        [shelter.org_name, shelter.contact_email, shelter.contact_phone,
         shelter.lng, shelter.lat, shelter.address_text,
         shelter.accepted_food_types, shelter.capacity_max]
      );
    }
    console.log(`Inserted ${shelters.length} recipients.\n`);

    // Seed drivers
    const drivers = generateDrivers();
    for (const driver of drivers) {
      await pool.query(
        `INSERT INTO drivers (name, contact_phone, current_location, status)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'available')`,
        [driver.name, driver.contact_phone, driver.lng, driver.lat]
      );
    }
    console.log(`Inserted ${drivers.length} drivers.\n`);

    // Verify counts
    const donorCount = await pool.query('SELECT COUNT(*) FROM donors');
    const recipientCount = await pool.query('SELECT COUNT(*) FROM recipients');
    const driverCount = await pool.query('SELECT COUNT(*) FROM drivers');
    
    console.log('=== Seed Complete ===');
    console.log(`Donors:     ${donorCount.rows[0].count}`);
    console.log(`Recipients: ${recipientCount.rows[0].count}`);
    console.log(`Drivers:    ${driverCount.rows[0].count}`);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    await pool.end();
    process.exit(1);
  }
}

seed();
