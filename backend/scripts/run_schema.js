/**
 * Run schema — executes DDL statements one at a time for compatibility
 * with Supabase transaction-mode pooler.
 */
require('dotenv').config();
const { pool } = require('../db');

const statements = [
  `CREATE EXTENSION IF NOT EXISTS postgis`,

  `CREATE TABLE IF NOT EXISTS donors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    location GEOGRAPHY(POINT) NOT NULL,
    address_text TEXT NOT NULL,
    city_id TEXT NOT NULL DEFAULT 'demo-city',
    created_at TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    location GEOGRAPHY(POINT) NOT NULL,
    address_text TEXT NOT NULL,
    city_id TEXT NOT NULL DEFAULT 'demo-city',
    accepted_food_types TEXT[] NOT NULL,
    capacity_current NUMERIC NOT NULL DEFAULT 0,
    capacity_max NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_phone TEXT,
    current_location GEOGRAPHY(POINT),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','en_route','busy')),
    city_id TEXT NOT NULL DEFAULT 'demo-city'
  )`,

  `CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES donors(id),
    food_description TEXT NOT NULL,
    food_type TEXT NOT NULL CHECK (food_type IN ('prepared_meals','produce','bakery','dairy','dry_goods','other')),
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('lbs','kg','servings')),
    weight_kg NUMERIC,
    pickup_location GEOGRAPHY(POINT) NOT NULL,
    pickup_address TEXT NOT NULL,
    posted_at TIMESTAMPTZ DEFAULT now(),
    expiry_window_end TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted'
      CHECK (status IN ('posted','matched','picked_up','delivered','expired','cancelled')),
    matched_recipient_id UUID REFERENCES recipients(id),
    matched_driver_id UUID REFERENCES drivers(id),
    city_id TEXT NOT NULL DEFAULT 'demo-city'
  )`,

  `CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID NOT NULL REFERENCES donations(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    pickup_eta TIMESTAMPTZ,
    dropoff_eta TIMESTAMPTZ,
    actual_pickup_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS impact_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID NOT NULL REFERENCES donations(id),
    weight_kg NUMERIC NOT NULL,
    meals_estimate NUMERIC NOT NULL,
    co2e_avoided_kg NUMERIC NOT NULL,
    logged_at TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status)`,
  `CREATE INDEX IF NOT EXISTS idx_recipients_location ON recipients USING GIST(location)`,
  `CREATE INDEX IF NOT EXISTS idx_donors_location ON donors USING GIST(location)`,

  // Auth supporting table
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('donor', 'recipient', 'driver')),
    profile_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`
];

async function runSchema() {
  console.log('Running schema statements...\n');
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const label = stmt.trim().substring(0, 60).replace(/\n/g, ' ');
    try {
      await pool.query(stmt);
      console.log(`  [${i + 1}/${statements.length}] OK: ${label}...`);
    } catch (err) {
      console.error(`  [${i + 1}/${statements.length}] FAIL: ${label}...`);
      console.error(`    Error: ${err.message}`);
    }
  }
  console.log('\nSchema complete.');
  await pool.end();
}

runSchema();
