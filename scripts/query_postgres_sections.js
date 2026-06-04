const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Conectado a PostgreSQL.');

  const seccioRes = await client.query('SELECT * FROM seccio');
  console.log('--- SECCIONES (seccio) ---');
  console.log(seccioRes.rows);

  const localRes = await client.query('SELECT * FROM secc_local');
  console.log('--- LOCALES (secc_local) ---');
  console.log(localRes.rows);

  await client.end();
}

run().catch(console.error);
