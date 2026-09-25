-- Users table for JWT authentication
-- This is a supporting auth table (not a domain entity from SRS §5).
-- It maps login credentials to the role-specific tables (donors, recipients, drivers).

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('donor', 'recipient', 'driver')),
  profile_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
