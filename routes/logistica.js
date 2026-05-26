const express = require('express');
const { authMiddleware, checkPermiso } = require('./auth');
const router = express.Router();

// Aplicar middleware de autenticación y de permisos para todo el enrutador de logística
router.use(authMiddleware);
router.use(checkPermiso('logistica'));

// Vehiculos GET
router.get('/vehiculos', async (req, res) => {
  try {
    const [rows] = await req.db.query('SELECT * FROM logistica_vehiculos WHERE activo = true');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Vehiculos POST
router.post('/vehiculos', async (req, res) => {
  const { tipo, chofer, telefono, placa, combustible } = req.body;
  try {
    const [r] = await req.db.query(
      'INSERT INTO logistica_vehiculos (tipo, chofer, telefono, placa, combustible) VALUES (?, ?, ?, ?, ?)',
      [tipo || 'movil', chofer, telefono, placa, combustible || 100.00]
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Traslados GET
router.get('/traslados', async (req, res) => {
  const { barrio_id } = req.query;
  try {
    let whereClause = '1=1';
    const params = [];
    if (barrio_id) {
      whereClause = 'e.CODIGO_SEC = ?';
      params.push(parseInt(barrio_id));
    }
    const [rows] = await req.db.query(`
      SELECT t.*, CONCAT(e.NOMBRE, ' ', COALESCE(e.APELLIDO, '')) as elector_nombre, '' as elector_telefono, e.DIRECCION as elector_direccion,
             v.chofer, v.placa, v.tipo
      FROM logistica_traslados t
      JOIN mas_pda e ON t.elector_id = e.id
      JOIN logistica_vehiculos v ON t.vehiculo_id = v.id
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
    `, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Traslados POST (Schedule)
router.post('/traslados', async (req, res) => {
  const { elector_id, vehiculo_id } = req.body;
  try {
    const [r] = await req.db.query(
      'INSERT INTO logistica_traslados (elector_id, vehiculo_id, estado) VALUES (?, ?, ?)',
      [elector_id, vehiculo_id, 'pendiente']
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Traslados PUT (Update Status)
router.put('/traslados/:id', async (req, res) => {
  const { estado } = req.body;
  try {
    await req.db.query(
      'UPDATE logistica_traslados SET estado = ? WHERE id = ?',
      [estado, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gastos GET
router.get('/gastos', async (req, res) => {
  const { barrio_id } = req.query;
  try {
    let whereClause = '1=1';
    const params = [];
    if (barrio_id) {
      whereClause = 'g.barrio_id = ?';
      params.push(parseInt(barrio_id));
    }
    const [rows] = await req.db.query(`
      SELECT g.*, v.chofer as chofer_nombre, v.placa as vehiculo_placa
      FROM logistica_gastos g
      LEFT JOIN logistica_vehiculos v ON g.vehiculo_id = v.id
      WHERE ${whereClause}
      ORDER BY g.fecha DESC, g.id DESC
    `, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gastos POST
router.post('/gastos', async (req, res) => {
  const { concepto, monto, vehiculo_id, fecha, observaciones, barrio_id } = req.body;
  try {
    const [r] = await req.db.query(
      'INSERT INTO logistica_gastos (concepto, monto, vehiculo_id, fecha, observaciones, barrio_id) VALUES (?, ?, ?, ?, ?, ?)',
      [concepto, monto, vehiculo_id || null, fecha || new Date(), observaciones || null, barrio_id ? parseInt(barrio_id) : null]
    );
    res.json({ id: r.insertId, success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gastos DELETE
router.delete('/gastos/:id', async (req, res) => {
  try {
    await req.db.query('DELETE FROM logistica_gastos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
