const express = require('express');
const { authMiddleware, checkPermiso } = require('./auth');
const router = express.Router();

router.get('/', authMiddleware, checkPermiso('mapa'), async (req, res) => {
  const { id } = req.query;
  try {
    let whereClause = '1=1';
    const params = [];
    if (id) {
      whereClause = 's.CODIGO_SEC = ?';
      params.push(parseInt(id));
    }
    const [rows] = await req.db.query(`
      SELECT 
        s.CODIGO_SEC as id,
        CASE 
          WHEN s.NDISTRITO = s.descripcio THEN s.NDISTRITO
          ELSE CONCAT(s.NDISTRITO, ' (', s.descripcio, ')')
        END as nombre,
        CASE 
          WHEN s.NDISTRITO = 'HOHENAU' THEN -27.0850
          WHEN s.NDISTRITO = 'OBLIGADO' THEN -27.0333
          WHEN s.NDISTRITO = 'BELLA VISTA' THEN -27.0500
          WHEN s.NDISTRITO = 'ENCARNACION' THEN -27.3306
          ELSE -27.3306 
        END as lat,
        CASE 
          WHEN s.NDISTRITO = 'HOHENAU' THEN -55.6500
          WHEN s.NDISTRITO = 'OBLIGADO' THEN -55.6335
          WHEN s.NDISTRITO = 'BELLA VISTA' THEN -55.5833
          WHEN s.NDISTRITO = 'ENCARNACION' THEN -55.8667
          ELSE -55.8667 
        END as lng,
        '#3b82f6' as color_mapa,
        (SELECT COUNT(*) FROM mas_pda e WHERE e.CODIGO_SEC = s.CODIGO_SEC) as total_electores,
        (SELECT COUNT(*) FROM mas_pda e WHERE e.CODIGO_SEC = s.CODIGO_SEC AND e.votado = 1) as votaron
      FROM seccio s
      WHERE ${whereClause}
      ORDER BY s.NDISTRITO
    `, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
