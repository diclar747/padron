const express = require('express');
const { authMiddleware, checkPermiso } = require('./auth');
const upload = require('../middleware/upload');
const router = express.Router();

// Aplicar middleware de autenticación y de permisos para todo el enrutador de incidencias (emergencia)
router.use(authMiddleware);
router.use(checkPermiso('emergencia'));

// GET /api/incidencias
router.get('/', async (req, res) => {
  const { barrio_id } = req.query;
  try {
    let whereClause = '1=1';
    const params = [];
    if (barrio_id) {
      whereClause = 'i.barrio_id = ?';
      params.push(parseInt(barrio_id));
    }
    const [rows] = await req.db.query(`
      SELECT i.*, u.nombre as veedor_nombre
      FROM incidencias i
      LEFT JOIN usuarios u ON i.veedor_id = u.id
      WHERE ${whereClause}
      ORDER BY i.barrio_id DESC, i.created_at DESC
    `, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/incidencias
router.post('/', upload.any(), async (req, res) => {
  const { tipo, descripcion, lat, lng, barrio_id } = req.body;
  const fotoFile = req.files?.find(f => f.fieldname === 'foto');
  const audioFile = req.files?.find(f => f.fieldname === 'audio');
  const foto_url = fotoFile ? '/uploads/' + fotoFile.filename : null;
  const audio_url = audioFile ? '/uploads/' + audioFile.filename : null;
  try {
    const [r] = await req.db.query(
      'INSERT INTO incidencias (veedor_id, tipo, descripcion, lat, lng, foto_url, audio_url, barrio_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, tipo || 'incidente', descripcion, lat, lng, foto_url, audio_url, barrio_id ? parseInt(barrio_id) : null]
    );
    const incidentData = {
      id: r.insertId,
      veedor_nombre: req.user.nombre,
      tipo: tipo || 'incidente',
      descripcion,
      lat,
      lng,
      foto_url,
      audio_url,
      created_at: new Date().toISOString()
    };
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast({ type: 'incidencia', data: incidentData });
    }
    res.json({ id: r.insertId, foto_url, audio_url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
