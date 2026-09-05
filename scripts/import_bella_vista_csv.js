/* =====================================================================
 * import_bella_vista_csv.js
 * ---------------------------------------------------------------------
 * Reemplaza por completo el padrón de Bella Vista en `mas_pda` a partir
 * de "BELLA VISTA.CSV" (formato oficial TSJE) y resetea el conteo del
 * simulacro para arrancar de nuevo.
 *
 *   node scripts/import_bella_vista_csv.js
 *
 * Efectos (irreversibles salvo backup):
 *   - Borra todos los electores actuales con codigo_sec = 276 (Bella
 *     Vista) en mas_pda, incluyendo veedor/telefono/observaciones/votado
 *     ya cargados, y los reemplaza 1 a 1 por el CSV.
 *   - Crea el secc_local que falte (por ahora: local 2, Col. Lauro Raatz).
 *   - Asigna mesa/orden agrupando de a 350 electores por local, ordenado
 *     alfabéticamente por apellido y nombre.
 *   - Vacía simulador_votos (el simulacro es de Bella Vista) para que el
 *     conteo arranque en cero.
 * ===================================================================== */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const CODIGO_SEC = 276; // Bella Vista (Itapúa)
const POR_MESA = 350;
const CSV_PATH = path.join(__dirname, '..', 'BELLA VISTA.CSV');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const db = new Pool({
  connectionString,
  ssl: /sslmode=require/.test(connectionString || '') ? { rejectUnauthorized: false } : false,
});

// ---- parser CSV simple (soporta campos entre comillas con comas) ------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // ignorar
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function limpiar(s) { return String(s == null ? '' : s).trim(); }

(async () => {
  console.log('Leyendo', CSV_PATH);
  const buf = fs.readFileSync(CSV_PATH);
  const text = buf.toString('latin1');
  const filas = parseCsv(text);
  const header = filas[0].map((h) => h.trim());
  const idx = (col) => header.indexOf(col);
  const iLocal = idx('local'), iDesLoc = idx('des_loc'), iCedula = idx('cedula'),
    iNombre = idx('nombre'), iApellido = idx('apellido'), iDirecc = idx('direcc'),
    iDistrito = idx('des_dis');

  const electores = [];
  const localesVistos = new Map(); // local -> des_loc
  for (let r = 1; r < filas.length; r++) {
    const f = filas[r];
    if (!f || f.length < header.length) continue;
    if (limpiar(f[iDistrito]).toUpperCase() !== 'BELLA VISTA') continue;
    const local = limpiar(f[iLocal]);
    const desLoc = limpiar(f[iDesLoc]);
    if (!localesVistos.has(local)) localesVistos.set(local, desLoc);
    electores.push({
      local,
      cedula: limpiar(f[iCedula]),
      nombre: limpiar(f[iNombre]),
      apellido: limpiar(f[iApellido]),
      direccion: limpiar(f[iDirecc]),
    });
  }
  console.log(`Electores leídos del CSV: ${electores.length}`);
  console.log('Locales detectados:', [...localesVistos.entries()]);

  // ---- mapear local del CSV -> secc_loc en la base ---------------------
  const { rows: localesDb } = await db.query(
    'SELECT codigo_loc, secc_loc, nombre_loc FROM secc_local WHERE codigo_sec = $1 ORDER BY codigo_loc',
    [CODIGO_SEC]
  );
  const localAsecLoc = new Map(localesDb.map((l) => [String(l.codigo_loc), l.secc_loc]));

  for (const [local, desLoc] of localesVistos) {
    const codigoLoc = parseInt(local, 10);
    if (!localAsecLoc.has(local)) {
      const secLoc = CODIGO_SEC * 10 + codigoLoc;
      await db.query(
        `INSERT INTO secc_local (codigo_dep, codigo_dis, codigo_sec, codigo_loc, cod_local, nombre_loc, direccion, recibido, secc_loc)
         VALUES (7, 3, $1, $2, $3, $4, '', '', $5)`,
        [CODIGO_SEC, codigoLoc, codigoLoc, desLoc, secLoc]
      );
      localAsecLoc.set(local, secLoc);
      console.log(`Creado secc_local para local ${local} (${desLoc}) -> secc_loc ${secLoc}`);
    }
  }

  // ---- ordenar alfabéticamente y asignar mesa/orden por local ----------
  electores.sort((a, b) => {
    if (a.local !== b.local) return a.local < b.local ? -1 : 1;
    const ka = (a.apellido + ' ' + a.nombre), kb = (b.apellido + ' ' + b.nombre);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const contadorLocal = {};
  for (const e of electores) {
    const n = contadorLocal[e.local] || 0;
    e.mesa = Math.floor(n / POR_MESA) + 1;
    e.orden = (n % POR_MESA) + 1;
    e.sec_loc = localAsecLoc.get(e.local);
    contadorLocal[e.local] = n + 1;
  }

  // ---- reemplazo dentro de una transacción ------------------------------
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query('DELETE FROM mas_pda WHERE codigo_sec = $1', [CODIGO_SEC]);
    console.log(`Borrados ${del.rowCount} electores anteriores de Bella Vista.`);

    const BATCH = 500;
    for (let i = 0; i < electores.length; i += BATCH) {
      const lote = electores.slice(i, i + BATCH);
      const cols = ['nombre', 'apellido', 'numero_ced', 'direccion', 'codigo_sec', 'mesa', 'sec_loc', 'votado', 'orden'];
      const values = [];
      const placeholders = lote.map((e, li) => {
        const base = li * cols.length;
        values.push(e.nombre, e.apellido, e.cedula, e.direccion, CODIGO_SEC, e.mesa, e.sec_loc, 0, e.orden);
        return '(' + cols.map((_, ci) => `$${base + ci + 1}`).join(',') + ')';
      });
      await client.query(
        `INSERT INTO mas_pda (${cols.join(',')}) VALUES ${placeholders.join(',')}`,
        values
      );
    }
    console.log(`Insertados ${electores.length} electores nuevos de Bella Vista.`);

    const resetSim = await client.query('DELETE FROM simulador_votos');
    console.log(`Simulacro reiniciado: ${resetSim.rowCount} votos borrados.`);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const { rows: [chk] } = await db.query(
    `SELECT COUNT(*)::int AS n FROM mas_pda WHERE codigo_sec = $1`,
    [CODIGO_SEC]
  );
  console.log('Total electores Bella Vista en la base ahora:', chk.n);

  await db.end();
})().catch((e) => {
  console.error('ERROR en la importación:', e);
  process.exit(1);
});
