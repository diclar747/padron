/* =====================================================================
 * seed_simulador_demo.js  —  SÓLO PARA PRUEBAS
 * ---------------------------------------------------------------------
 * Genera votos de demostración en `simulador_votos` usando cédulas
 * reales del padrón de Bella Vista, para poder ver la página de
 * resultados con datos. Requiere el servidor corriendo en :4000.
 *
 *   node scripts/seed_simulador_demo.js [cantidad]     (default 40)
 *
 * Para limpiar todo antes del simulacro real:
 *   - como admin:  POST /api/simulador/reset
 *   - o en la BD:  TRUNCATE simulador_votos;
 * ===================================================================== */
require('dotenv').config();
const { Pool } = require('pg');

const CANT = Math.max(1, parseInt(process.argv[2] || '40', 10));
const API = process.env.SIM_API || 'http://localhost:4000/api/simulador';

const db = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const CONCEJALES = [
  'NELSON ARMOA', 'LUCIO GONZÁLEZ', 'MARÍA ROSITA ARANDA', 'GLADYS AMARILLA',
  'CESNEN GRAU', 'JAVIER SILVERO', 'HÉCTOR CABRAL', 'ALDO ESCOBAR',
  'LUISITO MATIAUDA', 'JULIO DÁVALOS', 'JOSÉ BENÍTEZ', 'CELIA ESCOBAR',
];

(async () => {
  const { rows } = await db.query(
    `SELECT e.numero_ced AS ci
       FROM mas_pda e LEFT JOIN seccio s ON e.codigo_sec = s.codigo_sec
      WHERE s.ndistrito = 'BELLA VISTA' AND e.numero_ced ~ '^[0-9]{5,9}$'
      ORDER BY e.id LIMIT $1`, [CANT]
  );
  await db.end();

  let ok = 0, dup = 0, err = 0;
  for (const { ci } of rows) {
    const blancoInt = Math.random() < 0.12;
    const blancoJun = Math.random() < 0.15;
    const pref = 1 + Math.floor(Math.random() * 12);
    const body = {
      ci: String(ci), device_id: 'seed',
      intendente: blancoInt ? { lista: 'BLANCO' } : { lista: '1', candidato: 'EUCLIDES DE GODOIS', preferencia: 1 },
      junta: blancoJun ? { lista: 'BLANCO' } : { lista: '1', candidato: CONCEJALES[pref - 1], preferencia: pref },
    };
    try {
      const r = await fetch(API + '/voto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (r.status === 200) ok++;
      else if (r.status === 409) dup++;
      else err++;
    } catch (e) { err++; }
  }
  console.log(`demo: ${ok} votos nuevos, ${dup} ya existían, ${err} errores.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
