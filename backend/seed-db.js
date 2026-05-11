#!/usr/bin/env node

const fs = require('fs');
const { Pool } = require('pg');
const { resolve } = require('path');
const copyFrom = require('pg-copy-streams').from;

require('dotenv').config({ path: resolve(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
});

// Get file path from command line
const filePath = process.argv[2];
const table = process.argv[3];

if (!filePath) {
  console.error('No CSV file provided!');
  process.exit(1);
}

if (!table) {
  console.error('No table provided!');
  process.exit(1);
}

const resolvedPath = resolve(filePath);

async function seedCSV(file) {
  const client = await pool.connect();

  try {
    if (!fs.existsSync(file)) {
      throw new Error(`File not found: ${file}`);
    }

    await client.query('BEGIN');

    const stream = client.query(
      copyFrom(`
        COPY ${table} (observed_at, time, entity_id, entity_type, attr_name, attr_type, value, metadata)
        FROM STDIN
        WITH (
          FORMAT csv,
          HEADER true
        )
      `),
    );

    const fileStream = fs.createReadStream(file);

    await new Promise((resolve, reject) => {
      fileStream.pipe(stream).on('finish', resolve).on('error', reject);
    });

    await client.query('COMMIT');
    console.log(`CSV imported successfully from ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCSV(resolvedPath);
