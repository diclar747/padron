const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Conectado a PostgreSQL.');

  const res = await client.query('SELECT DISTINCT ndistrito FROM seccio ORDER BY ndistrito');
  console.log('Distritos encontrados:');
  console.log(res.rows);

  // Contar cuántos electores hay en total
  const countRes = await client.query('SELECT COUNT(*) FROM mas_pda');
  console.log('Total electores en mas_pda:', countRes.rows[0].count);

  await client.end();
}

run().catch(console.error);
