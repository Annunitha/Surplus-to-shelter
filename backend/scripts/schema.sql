-- Surplus-to-Shelter DDL — exact copy from ARCHITECTURE.md §3
-- Do not modify field names or types.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  location GEOGRAPHY(POINT) NOT NULL,
  address_text TEXT NOT NULL,
  city_id TEXT NOT NULL DEFAULT 'demo-city',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recipients (
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
);

CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_phone TEXT,
  current_location GEOGRAPHY(POINT),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','en_route','busy')),
  city_id TEXT NOT NULL DEFAULT 'demo-city'
);

CREATE TABLE donations (
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
);

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES donations(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  pickup_eta TIMESTAMPTZ,
  dropoff_eta TIMESTAMPTZ,
  actual_pickup_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ
);

CREATE TABLE impact_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES donations(id),
  weight_kg NUMERIC NOT NULL,
  meals_estimate NUMERIC NOT NULL,
  co2e_avoided_kg NUMERIC NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_recipients_location ON recipients USING GIST(location);
CREATE INDEX idx_donors_location ON donors USING GIST(location);
