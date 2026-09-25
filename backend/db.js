const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

function resolveDatabasePath() {
  const raw = process.env.DATABASE_URL || 'sqlite:./data/surplus_to_shelter.db';

  if (raw.startsWith('sqlite:')) {
    const dbPath = raw.replace(/^sqlite:/, '').replace(/^\/+/, '');
    return path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, dbPath);
  }

  if (raw.startsWith('file:')) {
    const match = raw.match(/^file:(?:\/\/)?(.+)$/);
    const dbPath = match ? match[1] : raw;
    return path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, dbPath);
  }

  return path.join(__dirname, 'data', 'surplus_to_shelter.db');
}

const dbPath = resolveDatabasePath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new sqlite3.Database(dbPath);

function normalizeSql(sql, params = []) {
  let normalized = sql.trim();

  normalized = normalized.replace(/::\w+/g, '');
  normalized = normalized.replace(/COUNT\(\*\)::int/gi, 'COUNT(*)');
  normalized = normalized.replace(/COUNT\(\*\)::integer/gi, 'COUNT(*)');
  normalized = normalized.replace(/NOW\(\)/gi, "datetime('now')");
  normalized = normalized.replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");
  normalized = normalized.replace(/interval\s+'([^']+)'/gi, "");
  normalized = normalized.replace(/\+\s*interval\s+'([^']+)'/gi, (_, value) => {
    const match = value.trim().match(/^(\d+)\s+(second|minute|hour|day|month|year)s?$/i);
    if (!match) return "";
    const [, amount, unit] = match;
    return `, '${amount} ${unit}'`;
  });
  normalized = normalized.replace(/-\s*interval\s+'([^']+)'/gi, (_, value) => {
    const match = value.trim().match(/^(\d+)\s+(second|minute|hour|day|month|year)s?$/i);
    if (!match) return "";
    const [, amount, unit] = match;
    return `, '-${amount} ${unit}'`;
  });

  normalized = normalized.replace(/ST_Y\(([^)]+)\)/gi, (_, expr) => {
    const clean = expr.replace(/::geometry|::geography/g, '').trim();
    if (clean.includes('pickup_location')) return 'pickup_lat';
    if (clean.includes('current_location')) return 'lat';
    if (clean.includes('location')) return 'lat';
    return 'lat';
  });

  normalized = normalized.replace(/ST_X\(([^)]+)\)/gi, (_, expr) => {
    const clean = expr.replace(/::geometry|::geography/g, '').trim();
    if (clean.includes('pickup_location')) return 'pickup_lng';
    if (clean.includes('current_location')) return 'lng';
    if (clean.includes('location')) return 'lng';
    return 'lng';
  });

  normalized = normalized.replace(/ST_Distance\([^)]*\)/gi, '0');
  normalized = normalized.replace(/ST_DWithin\([^)]*\)/gi, '1 = 1');

  const positional = [];
  normalized = normalized.replace(/\$(\d+)/g, (_, index) => {
    const valueIndex = Number(index) - 1;
    positional.push(params[valueIndex]);
    return '?';
  });

  normalized = normalized.replace(/ST_SetSRID\(ST_MakePoint\((\$\d+),(\$\d+)\),\s*4326\)::geography/gi, 'json_object(\'lat\', ?, \'lng\', ?)');
  if (normalized.includes('json_object(\'lat\', ?, \'lng\', ?)')) {
    const spliceCount = (normalized.match(/json_object\('lat', \?, 'lng', \?\)/gi) || []).length;
    const generated = [];
    for (let i = 0; i < spliceCount; i++) {
      generated.push(positional.shift(), positional.shift());
    }
    positional.unshift(...generated);
  }

  return { sql: normalized, params: positional };
}

function serializeValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function withUuidDefaults(sql, params) {
  if (!sql.toUpperCase().startsWith('INSERT INTO ')) return { sql, params };

  if (sql.toUpperCase().includes('INSERT INTO USERS')) {
    const hasId = sql.toUpperCase().includes('ID') && sql.includes('VALUES');
    if (!hasId && !sql.toUpperCase().includes('PROFILE_ID')) {
      params.unshift(require('crypto').randomUUID());
      return { sql: sql.replace(/INSERT INTO users \(([^)]+)\) VALUES/, 'INSERT INTO users (id, $1) VALUES'), params };
    }
  }

  return { sql, params };
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const { sql: normalizedSql, params: normalizedParams } = normalizeSql(sql, params);
    const finalSql = normalizedSql;

    db.all(finalSql, normalizedParams.map(serializeValue), (err, rows) => {
      if (err) {
        return reject(err);
      }

      const upper = finalSql.trim().toUpperCase();
      if (upper.startsWith('SELECT')) {
        resolve({ rows, rowCount: rows.length });
        return;
      }

      if (upper.startsWith('INSERT')) {
        const id = normalizedParams[0];
        resolve({ rows: [{ id, ...normalizedParams }], rowCount: 1 });
        return;
      }

      resolve({ rows: [], rowCount: 0 });
    });
  });
}

const pool = {
  query: runQuery,
  async connect() {
    return {
      query: runQuery,
      release() {},
      async begin() {},
      async commit() {},
      async rollback() {}
    };
  },
  end() {
    return new Promise((resolve, reject) => {
      db.close((err) => (err ? reject(err) : resolve()));
    });
  }
};

function createSchema() {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS donors (
      id TEXT PRIMARY KEY,
      org_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      location TEXT,
      lat REAL,
      lng REAL,
      address_text TEXT NOT NULL,
      city_id TEXT NOT NULL DEFAULT 'demo-city',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipients (
      id TEXT PRIMARY KEY,
      org_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      location TEXT,
      lat REAL,
      lng REAL,
      address_text TEXT NOT NULL,
      city_id TEXT NOT NULL DEFAULT 'demo-city',
      accepted_food_types TEXT,
      capacity_current REAL NOT NULL DEFAULT 0,
      capacity_max REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_phone TEXT,
      current_location TEXT,
      lat REAL,
      lng REAL,
      status TEXT NOT NULL DEFAULT 'available',
      city_id TEXT NOT NULL DEFAULT 'demo-city'
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      donor_id TEXT NOT NULL,
      food_description TEXT NOT NULL,
      food_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      weight_kg REAL,
      pickup_location TEXT,
      pickup_lat REAL,
      pickup_lng REAL,
      pickup_address TEXT NOT NULL,
      posted_at TEXT DEFAULT (datetime('now')),
      expiry_window_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'posted',
      matched_recipient_id TEXT,
      matched_driver_id TEXT,
      city_id TEXT NOT NULL DEFAULT 'demo-city'
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      pickup_eta TEXT,
      dropoff_eta TEXT,
      actual_pickup_time TEXT,
      actual_delivery_time TEXT
    );

    CREATE TABLE IF NOT EXISTS impact_log (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      meals_estimate REAL NOT NULL,
      co2e_avoided_kg REAL NOT NULL,
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
    CREATE INDEX IF NOT EXISTS idx_donations_match ON donations(matched_recipient_id);
  `;

  return new Promise((resolve, reject) => {
    db.exec(schemaSql, (err) => (err ? reject(err) : resolve()));
  });
}

createSchema().catch((err) => {
  console.error('SQLite schema initialization failed:', err.message);
});

module.exports = { db, pool, createSchema, resolveDatabasePath };
