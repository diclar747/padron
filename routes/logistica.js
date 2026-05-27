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
  await db.query(`
    CREATE TABLE IF NOT EXISTS camp_vehiculos (
      id           SERIAL PRIMARY KEY,
      nombre       VARCHAR(120) NOT NULL,
      placa        VARCHAR(30),
      modelo       VARCHAR(100),
      chofer       VARCHAR(200),
      telefono     VARCHAR(30),
      capacidad    INTEGER DEFAULT 5,
      combustible  INTEGER DEFAULT 100,
      estado       VARCHAR(20) DEFAULT 'disponible',
      observaciones TEXT,
      activo       BOOLEAN DEFAULT TRUE,
      created_at   TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS camp_tareas (
      id                SERIAL PRIMARY KEY,
      titulo            VARCHAR(200) NOT NULL,
      descripcion       TEXT,
      tipo              VARCHAR(80),
      asignado_nombre   VARCHAR(200),
      vehiculo_id       INTEGER REFERENCES camp_vehiculos(id) ON DELETE SET NULL,
      estado            VARCHAR(20) DEFAULT 'pendiente',
      prioridad         VARCHAR(20) DEFAULT 'normal',
      tiempo_estimado   INTEGER,
      created_by        INTEGER,
      created_at        TIMESTAMP DEFAULT NOW(),
      updated_at        TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS camp_actividades (
      id                 SERIAL PRIMARY KEY,
      tipo               VARCHAR(80) NOT NULL,
      descripcion        TEXT,
      categoria          VARCHAR(50),
      vehiculo_id        INTEGER REFERENCES camp_vehiculos(id) ON DELETE SET NULL,
      responsable_id     INTEGER,
      responsable_nombre VARCHAR(200),
      lat                DECIMAL(10,6),
      lng                DECIMAL(10,6),
      fecha              TIMESTAMP DEFAULT NOW(),
      created_at         TIMESTAMP DEFAULT NOW()
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

// ── VEHÍCULOS DE CAMPAÑA ─────────────────────────────────────────
router.get('/vehiculos-camp', checkPermiso('logistica'), async (req, res) => {
  try {
    const [rows] = await req.db.query(`
      SELECT v.*,
        (SELECT COUNT(*) FROM camp_tareas t WHERE t.vehiculo_id = v.id AND t.estado != 'completado') AS tareas_activas
      FROM camp_vehiculos v WHERE v.activo = TRUE ORDER BY v.id ASC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/vehiculos-camp', checkPermiso('logistica'), async (req, res) => {
  const { nombre, placa, modelo, chofer, telefono, capacidad, combustible, estado, observaciones } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre del vehículo es obligatorio' });
  try {
    const [r] = await req.db.query(
      `INSERT INTO camp_vehiculos (nombre, placa, modelo, chofer, telefono, capacidad, combustible, estado, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, placa||null, modelo||null, chofer||null, telefono||null,
       parseInt(capacidad)||5, parseInt(combustible)||100, estado||'disponible', observaciones||null]
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/vehiculos-camp/:id', checkPermiso('logistica'), async (req, res) => {
  const { nombre, placa, modelo, chofer, telefono, capacidad, combustible, estado, observaciones } = req.body;
  try {
    await req.db.query(
      `UPDATE camp_vehiculos SET nombre=?, placa=?, modelo=?, chofer=?, telefono=?,
       capacidad=?, combustible=?, estado=?, observaciones=? WHERE id=?`,
      [nombre, placa||null, modelo||null, chofer||null, telefono||null,
       parseInt(capacidad)||5, parseInt(combustible)||100, estado||'disponible',
       observaciones||null, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/vehiculos-camp/:id', checkPermiso('logistica'), async (req, res) => {
  try {
    await req.db.query('UPDATE camp_vehiculos SET activo = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TAREAS ────────────────────────────────────────────────────────
router.get('/tareas', checkPermiso('logistica'), async (req, res) => {
  const { estado } = req.query;
  try {
    let sql = `
      SELECT t.*, v.nombre AS vehiculo_nombre, v.placa AS vehiculo_placa, v.chofer AS vehiculo_chofer
      FROM camp_tareas t LEFT JOIN camp_vehiculos v ON t.vehiculo_id = v.id WHERE 1=1
    `;
    const params = [];
    if (estado) { sql += ' AND t.estado = ?'; params.push(estado); }
    sql += ' ORDER BY t.created_at DESC';
    const [rows] = await req.db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tareas', checkPermiso('logistica'), async (req, res) => {
  const { titulo, descripcion, tipo, asignado_nombre, vehiculo_id, prioridad, tiempo_estimado } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });
  try {
    const [r] = await req.db.query(
      `INSERT INTO camp_tareas (titulo, descripcion, tipo, asignado_nombre, vehiculo_id, prioridad, tiempo_estimado, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [titulo, descripcion||null, tipo||null, asignado_nombre||null,
       vehiculo_id ? parseInt(vehiculo_id) : null, prioridad||'normal',
       tiempo_estimado ? parseInt(tiempo_estimado) : null, req.user.id]
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/tareas/:id', checkPermiso('logistica'), async (req, res) => {
  const allowed = ['titulo','descripcion','tipo','asignado_nombre','vehiculo_id','estado','prioridad','tiempo_estimado'];
  const updates = [];
  const vals = [];
  allowed.forEach(k => {
    if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
  });
  if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
  updates.push('updated_at=NOW()');
  vals.push(req.params.id);
  try {
    await req.db.query(`UPDATE camp_tareas SET ${updates.join(',')} WHERE id=?`, vals);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tareas/:id', checkPermiso('logistica'), async (req, res) => {
  try {
    await req.db.query('DELETE FROM camp_tareas WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ACTIVIDADES ───────────────────────────────────────────────────
router.get('/actividades', checkPermiso('logistica'), async (req, res) => {
  try {
    const [rows] = await req.db.query(`
      SELECT a.*, v.nombre AS vehiculo_nombre, v.placa AS vehiculo_placa
      FROM camp_actividades a LEFT JOIN camp_vehiculos v ON a.vehiculo_id = v.id
      ORDER BY a.created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/actividades', checkPermiso('logistica'), async (req, res) => {
  const { tipo, descripcion, categoria, vehiculo_id, lat, lng } = req.body;
  if (!tipo) return res.status(400).json({ error: 'El tipo de actividad es obligatorio' });
  try {
    const [r] = await req.db.query(
      `INSERT INTO camp_actividades (tipo, descripcion, categoria, vehiculo_id, responsable_id, responsable_nombre, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tipo, descripcion||null, categoria||null,
       vehiculo_id ? parseInt(vehiculo_id) : null,
       req.user.id, req.user.nombre || req.user.email,
       lat||null, lng||null]
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/actividades/:id', checkPermiso('logistica'), async (req, res) => {
  try {
    await req.db.query('DELETE FROM camp_actividades WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ALERTAS ────────────────────────────────────────────────────────
router.get('/alertas', checkPermiso('logistica'), async (req, res) => {
  try {
    const alertas = [];
    // 1. Presupuestos cerca del límite
    const [presupuestos] = await req.db.query(`
      SELECT p.*, COALESCE((SELECT SUM(g.monto) FROM camp_gastos g WHERE g.presupuesto_id=p.id),0) AS gastado
      FROM camp_presupuestos p WHERE p.activo=TRUE
    `);
    for (const p of presupuestos) {
      const pct = p.monto_total > 0 ? parseInt(p.gastado) / parseInt(p.monto_total) * 100 : 0;
      if (pct >= 100) alertas.push({ nivel: 'critico', tipo: 'presupuesto', mensaje: `Rubro "${p.nombre}" AGOTADO`, detalle: `Gastado: ${parseInt(p.gastado).toLocaleString('es-PY')} Gs.` });
      else if (pct >= 90) alertas.push({ nivel: 'alto', tipo: 'presupuesto', mensaje: `Rubro "${p.nombre}" al ${Math.round(pct)}%`, detalle: 'Quedan menos del 10% de fondos' });
      else if (pct >= 75) alertas.push({ nivel: 'medio', tipo: 'presupuesto', mensaje: `Rubro "${p.nombre}" al ${Math.round(pct)}%`, detalle: 'Monitorear el gasto' });
    }
    // 2. Vehículos con combustible bajo
    const [vehiculos] = await req.db.query(`SELECT * FROM camp_vehiculos WHERE activo=TRUE AND combustible < 25`);
    for (const v of vehiculos) {
      alertas.push({ nivel: v.combustible < 10 ? 'critico' : 'alto', tipo: 'vehiculo', mensaje: `Combustible bajo: ${v.nombre}`, detalle: `${v.combustible}% — Chofer: ${v.chofer||'-'}` });
    }
    // 3. Gastos inusualmente altos (> Gs. 5.000.000 en una sola carga)
    const [gastosAltos] = await req.db.query(`
      SELECT * FROM camp_gastos WHERE monto > 5000000 AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY monto DESC LIMIT 5
    `);
    for (const g of gastosAltos) {
      alertas.push({ nivel: 'medio', tipo: 'gasto', mensaje: `Gasto alto: ${g.categoria}`, detalle: `${parseInt(g.monto).toLocaleString('es-PY')} Gs. — ${g.responsable_nombre||'-'}` });
    }
    // 4. Tareas atrasadas (más de 2 horas en estado pendiente)
    const [tareasAtr] = await req.db.query(`
      SELECT * FROM camp_tareas WHERE estado='pendiente' AND prioridad='urgente' AND created_at < NOW() - INTERVAL '2 hours'
    `);
    for (const t of tareasAtr) {
      alertas.push({ nivel: 'alto', tipo: 'tarea', mensaje: `Tarea urgente sin iniciar: "${t.titulo}"`, detalle: `Asignado: ${t.asignado_nombre||'Sin asignar'}` });
    }
    res.json(alertas);
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
