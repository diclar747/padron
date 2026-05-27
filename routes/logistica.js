const express = require('express');
const { authMiddleware, checkPermiso } = require('./auth');
const router = express.Router();

// ── Auto-create tables on first use ───────────────────────────────
let tablesReady = false;
async function ensureTables(db) {
  if (tablesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS camp_presupuestos (
      id          SERIAL PRIMARY KEY,
      nombre      VARCHAR(120) NOT NULL,
      monto_total BIGINT       NOT NULL DEFAULT 0,
      color       VARCHAR(20)  DEFAULT 'blue',
      descripcion TEXT,
      activo      BOOLEAN      DEFAULT TRUE,
      created_at  TIMESTAMP    DEFAULT NOW(),
      created_by  INTEGER
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS camp_gastos (
      id                 SERIAL PRIMARY KEY,
      presupuesto_id     INTEGER REFERENCES camp_presupuestos(id) ON DELETE SET NULL,
      categoria          VARCHAR(100) NOT NULL,
      monto              BIGINT       NOT NULL,
      descripcion        TEXT,
      responsable_id     INTEGER,
      responsable_nombre VARCHAR(200),
      fecha              DATE         DEFAULT CURRENT_DATE,
      hora               TIME         DEFAULT CURRENT_TIME,
      foto_url           TEXT,
      lat                DECIMAL(10,6),
      lng                DECIMAL(10,6),
      observaciones      TEXT,
      created_at         TIMESTAMP    DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS camp_caja (
      id                   SERIAL PRIMARY KEY,
      tipo                 VARCHAR(30)  NOT NULL,
      monto                BIGINT       NOT NULL,
      descripcion          TEXT,
      responsable_id       INTEGER,
      responsable_nombre   VARCHAR(200),
      destinatario_nombre  VARCHAR(200),
      fecha                TIMESTAMP    DEFAULT NOW(),
      observaciones        TEXT
    )
  `);
  tablesReady = true;
}

// Apply auth to all routes
router.use(authMiddleware);
router.use(async (req, res, next) => {
  try { await ensureTables(req.db); } catch (e) { console.error('camp tables init:', e.message); }
  next();
});

// ── PRESUPUESTOS ─────────────────────────────────────────────────
router.get('/presupuestos', checkPermiso('logistica'), async (req, res) => {
  try {
    const [rows] = await req.db.query(`
      SELECT p.*,
        COALESCE((SELECT SUM(g.monto) FROM camp_gastos g WHERE g.presupuesto_id = p.id), 0) AS gastado
      FROM camp_presupuestos p
      WHERE p.activo = TRUE
      ORDER BY p.id ASC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/presupuestos', checkPermiso('logistica'), async (req, res) => {
  const { nombre, monto_total, color, descripcion } = req.body;
  if (!nombre || !monto_total) return res.status(400).json({ error: 'Nombre y monto son obligatorios' });
  try {
    const [r] = await req.db.query(
      'INSERT INTO camp_presupuestos (nombre, monto_total, color, descripcion, created_by) VALUES (?, ?, ?, ?, ?)',
      [nombre, parseInt(monto_total), color || 'blue', descripcion || null, req.user.id]
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/presupuestos/:id', checkPermiso('logistica'), async (req, res) => {
  const { nombre, monto_total, color, descripcion } = req.body;
  try {
    await req.db.query(
      'UPDATE camp_presupuestos SET nombre=?, monto_total=?, color=?, descripcion=? WHERE id=?',
      [nombre, parseInt(monto_total), color || 'blue', descripcion || null, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/presupuestos/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo administradores pueden eliminar presupuestos' });
  try {
    await req.db.query('UPDATE camp_presupuestos SET activo = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GASTOS ───────────────────────────────────────────────────────
router.get('/gastos', checkPermiso('logistica'), async (req, res) => {
  const { presupuesto_id, fecha_desde, fecha_hasta, categoria } = req.query;
  try {
    let sql = `
      SELECT g.*, p.nombre AS presupuesto_nombre, p.color AS presupuesto_color
      FROM camp_gastos g
      LEFT JOIN camp_presupuestos p ON g.presupuesto_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (presupuesto_id) { sql += ' AND g.presupuesto_id = ?'; params.push(parseInt(presupuesto_id)); }
    if (categoria)      { sql += ' AND g.categoria ILIKE ?';  params.push(`%${categoria}%`); }
    if (fecha_desde)    { sql += ' AND g.fecha >= ?';          params.push(fecha_desde); }
    if (fecha_hasta)    { sql += ' AND g.fecha <= ?';          params.push(fecha_hasta); }
    sql += ' ORDER BY g.created_at DESC';
    const [rows] = await req.db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/gastos', checkPermiso('logistica'), async (req, res) => {
  const { presupuesto_id, categoria, monto, descripcion, fecha, lat, lng, observaciones } = req.body;
  if (!categoria || !monto) return res.status(400).json({ error: 'Categoría y monto son obligatorios' });
  try {
    const [r] = await req.db.query(
      `INSERT INTO camp_gastos
        (presupuesto_id, categoria, monto, descripcion, responsable_id, responsable_nombre, fecha, lat, lng, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        presupuesto_id ? parseInt(presupuesto_id) : null,
        categoria,
        parseInt(monto),
        descripcion || null,
        req.user.id,
        req.user.nombre || req.user.email,
        fecha || new Date().toISOString().split('T')[0],
        lat  || null,
        lng  || null,
        observaciones || null
      ]
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/gastos/:id', checkPermiso('logistica'), async (req, res) => {
  try {
    await req.db.query('DELETE FROM camp_gastos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CAJA ─────────────────────────────────────────────────────────
router.get('/caja', checkPermiso('logistica'), async (req, res) => {
  try {
    const [rows] = await req.db.query(
      'SELECT * FROM camp_caja ORDER BY fecha DESC LIMIT 100'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/caja', checkPermiso('logistica'), async (req, res) => {
  const { tipo, monto, descripcion, destinatario_nombre, observaciones } = req.body;
  if (!tipo || !monto) return res.status(400).json({ error: 'Tipo y monto son obligatorios' });
  try {
    const [r] = await req.db.query(
      `INSERT INTO camp_caja (tipo, monto, descripcion, responsable_id, responsable_nombre, destinatario_nombre, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tipo, parseInt(monto), descripcion || null, req.user.id,
       req.user.nombre || req.user.email, destinatario_nombre || null, observaciones || null]
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/caja/:id', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  try {
    await req.db.query('DELETE FROM camp_caja WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── BALANCE CONSOLIDADO ───────────────────────────────────────────
router.get('/balance', checkPermiso('logistica'), async (req, res) => {
  try {
    const [[presupuestos]] = [await req.db.query(`
      SELECT p.*,
        COALESCE((SELECT SUM(g.monto) FROM camp_gastos g WHERE g.presupuesto_id = p.id), 0) AS gastado
      FROM camp_presupuestos p WHERE p.activo = TRUE ORDER BY p.id ASC
    `)];
    const [[categorias]] = [await req.db.query(`
      SELECT categoria, SUM(monto) AS total, COUNT(*) AS cantidad
      FROM camp_gastos GROUP BY categoria ORDER BY total DESC
    `)];
    const [[totalesRows]] = [await req.db.query(`
      SELECT
        (SELECT COALESCE(SUM(monto_total),0) FROM camp_presupuestos WHERE activo=TRUE) AS total_presupuesto,
        (SELECT COALESCE(SUM(monto),0)       FROM camp_gastos)                         AS total_gastado
    `)];
    const [[cajaRows]] = [await req.db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END),0)                    AS ingresos,
        COALESCE(SUM(CASE WHEN tipo IN ('egreso','entrega','rendicion') THEN monto ELSE 0 END),0) AS egresos
      FROM camp_caja
    `)];
    const [[recientesRows]] = [await req.db.query(`
      SELECT g.*, p.nombre AS presupuesto_nombre, p.color AS presupuesto_color
      FROM camp_gastos g
      LEFT JOIN camp_presupuestos p ON g.presupuesto_id = p.id
      ORDER BY g.created_at DESC LIMIT 10
    `)];

    res.json({
      presupuestos,
      categorias,
      total_presupuesto: parseInt(totalesRows[0]?.total_presupuesto || 0),
      total_gastado:     parseInt(totalesRows[0]?.total_gastado     || 0),
      caja:              cajaRows[0] || { ingresos: 0, egresos: 0 },
      recientes:         recientesRows
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── VEHICULOS (legacy) ────────────────────────────────────────────
router.get('/vehiculos', checkPermiso('logistica'), async (req, res) => {
  try {
    const [rows] = await req.db.query('SELECT * FROM logistica_vehiculos WHERE activo = true');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/vehiculos', checkPermiso('logistica'), async (req, res) => {
  const { tipo, chofer, telefono, placa, combustible } = req.body;
  try {
    const [r] = await req.db.query(
      'INSERT INTO logistica_vehiculos (tipo, chofer, telefono, placa, combustible) VALUES (?, ?, ?, ?, ?)',
      [tipo || 'movil', chofer, telefono, placa, combustible || 100.00]
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TRASLADOS (legacy) ────────────────────────────────────────────
router.get('/traslados', checkPermiso('logistica'), async (req, res) => {
  try {
    const [rows] = await req.db.query(`
      SELECT t.*, CONCAT(e.NOMBRE,' ',COALESCE(e.APELLIDO,'')) AS elector_nombre,
             e.DIRECCION AS elector_direccion, v.chofer, v.placa, v.tipo
      FROM logistica_traslados t
      JOIN mas_pda e ON t.elector_id = e.id
      JOIN logistica_vehiculos v ON t.vehiculo_id = v.id
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/traslados', checkPermiso('logistica'), async (req, res) => {
  const { elector_id, vehiculo_id } = req.body;
  try {
    const [r] = await req.db.query(
      'INSERT INTO logistica_traslados (elector_id, vehiculo_id, estado) VALUES (?, ?, ?)',
      [elector_id, vehiculo_id, 'pendiente']
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/traslados/:id', checkPermiso('logistica'), async (req, res) => {
  const { estado } = req.body;
  try {
    await req.db.query('UPDATE logistica_traslados SET estado = ? WHERE id = ?', [estado, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
