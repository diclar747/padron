const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Conectado a PostgreSQL.');

  // Contar total de electores por CODIGO_SEC en mas_pda
  const res = await client.query(`
    SELECT CODIGO_SEC, COUNT(*) as cantidad
    FROM mas_pda
    GROUP BY CODIGO_SEC
    ORDER BY CODIGO_SEC
  `);
  console.log('--- Electores por sección (CODIGO_SEC) ---');
  console.log(res.rows);

  // Contar total general para Encarnación (secciones 165, 342, 343)
  const encarnacionRes = await client.query(`
    SELECT COUNT(*) as total
    FROM mas_pda
    WHERE CODIGO_SEC IN (165, 342, 343)
  `);
  console.log('--- Electores en Encarnación (165, 342, 343) ---');
  console.log(encarnacionRes.rows);

  // Ver qué secciones existen en la tabla seccio
  const seccioRes = await client.query(`
    SELECT * FROM seccio
  `);
  console.log('--- Secciones en la tabla seccio ---');
  console.log(seccioRes.rows);

  await client.end();
}

run().catch(console.error);
