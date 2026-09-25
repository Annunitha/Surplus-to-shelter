/**
 * Run schema — creates the SQLite schema used by the local backend.
 */
require('dotenv').config();
const { pool, createSchema } = require('../db');

async function runSchema() {
  try {
    await createSchema();
    console.log('SQLite schema initialized successfully.');
  } catch (err) {
    console.error('SQLite schema failed:', err.message);
  } finally {
    await pool.end();
  }
}

runSchema();
