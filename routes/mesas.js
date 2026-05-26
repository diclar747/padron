const express = require('express');
const { authMiddleware, checkPermiso } = require('./auth');
const router = express.Router();

router.get('/', authMiddleware, checkPermiso('mesas'), async (req, res) => {
  const { barrio_id } = req.query;
  try {
    let whereClause = '1=1';
    const params = [];
    if (barrio_id) {
      whereClause = 'e.CODIGO_SEC = ?';
      params.push(parseInt(barrio_id));
    }
    const [rows] = await req.db.query(`
      SELECT 
        -- unique id generated from hashing seccional + local + mesa
        (e.CODIGO_SEC * 100000 + e.SEC_LOC * 100 + e.MESA) as id,
        e.MESA as numero,
        IFNULL(sl.NOMBRE_LOC, 'LOCAL GENERAL') as local,
        IFNULL(sl.DIRECCION, '') as direccion,
        CASE 
          WHEN s.NDISTRITO = 'HOHENAU' THEN -27.0852
          WHEN s.NDISTRITO = 'OBLIGADO' THEN -27.0335
          WHEN s.NDISTRITO = 'BELLA VISTA' THEN -27.0502
          ELSE -27.0502 
        END as lat,
        CASE 
          WHEN s.NDISTRITO = 'HOHENAU' THEN -55.6502
          WHEN s.NDISTRITO = 'OBLIGADO' THEN -55.6335
          WHEN s.NDISTRITO = 'BELLA VISTA' THEN -55.5835
          ELSE -55.6002 
        END as lng,
        COUNT(*) as electores_esperados,
        COUNT(*) as electores_cargados,
        SUM(CASE WHEN e.votado = 1 THEN 1 ELSE 0 END) as votaron,
        e.SEC_LOC as barrio_id,
        s.NDISTRITO as barrio_nombre
      FROM mas_pda e
      LEFT JOIN secc_local sl ON e.SEC_LOC = sl.SECC_LOC
      LEFT JOIN seccio s ON e.CODIGO_SEC = s.CODIGO_SEC
      WHERE ${whereClause}
      GROUP BY e.CODIGO_SEC, e.SEC_LOC, e.MESA, sl.NOMBRE_LOC, sl.DIRECCION, s.NDISTRITO
      ORDER BY s.NDISTRITO, e.MESA
    `, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', authMiddleware, checkPermiso('mesas'), async (req, res) => {
  const { id } = req.params;
  // Decode id
  const mesa = Math.floor(id % 100);
  const sec_loc = Math.floor((id % 100000) / 100);
  const codigo_sec = Math.floor(id / 100000);
  
  try {
    const [rows] = await req.db.query(`
      SELECT 
        (e.CODIGO_SEC * 100000 + e.SEC_LOC * 100 + e.MESA) as id,
        e.MESA as numero,
        IFNULL(sl.NOMBRE_LOC, 'LOCAL GENERAL') as local,
        IFNULL(sl.DIRECCION, '') as direccion
      FROM mas_pda e
      LEFT JOIN secc_local sl ON e.SEC_LOC = sl.SECC_LOC
      WHERE e.CODIGO_SEC = ? AND e.SEC_LOC = ? AND e.MESA = ?
      LIMIT 1
    `, [codigo_sec, sec_loc, mesa]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Mesa no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
