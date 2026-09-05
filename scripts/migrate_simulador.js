/* =====================================================================
 * migrate_simulador.js
 * ---------------------------------------------------------------------
 * Crea la tabla `simulador_votos` (contabilización del simulador de voto)
 * en la base configurada en DATABASE_URL (Neon / PostgreSQL).
 *
 *   node scripts/migrate_simulador.js
 *
 * Es idempotente: usa CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
 * ===================================================================== */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const sqlPath = path.join(__dirname, '..', 'database', 'simulador.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await db.query(sql);

  const cols = await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'simulador_votos' ORDER BY ordinal_position`
  );
  const idx = await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'simulador_votos'`);

  console.log('OK — tabla simulador_votos lista.');
  console.log('Columnas:', cols.rows.map((r) => r.column_name).join(', '));
  console.log('Índices :', idx.rows.map((r) => r.indexname).join(', '));

  await db.end();
})().catch((e) => {
  console.error('ERROR en la migración:', e.message);
  process.exit(1);
});
