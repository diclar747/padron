const express = require('express');
const { authMiddleware, checkPermiso } = require('./auth');
const router = express.Router();

router.get('/dashboard', authMiddleware, checkPermiso('dashboard'), async (req, res) => {
  const { barrio_id } = req.query;
  try {
    let whereClause = '1=1';
    const params = [];
    if (barrio_id) {
      whereClause = 'CODIGO_SEC = ?';
      params.push(parseInt(barrio_id));
    }

    const [[electores]] = await req.db.query(`SELECT COUNT(*) as total FROM mas_pda WHERE ${whereClause}`, params);
    const [[votaron]] = await req.db.query(`SELECT COUNT(*) as total FROM mas_pda WHERE votado = 1 AND ${whereClause}`, params);
    const [[no_votaron]] = await req.db.query(`SELECT COUNT(*) as total FROM mas_pda WHERE votado = 0 AND ${whereClause}`, params);
    
    // Total unique mesas combination
    const [[mesas]] = await req.db.query(`SELECT COUNT(DISTINCT CODIGO_SEC, SEC_LOC, MESA) as total FROM mas_pda WHERE ${whereClause}`, params);
    
    let barriosSql = 'SELECT COUNT(*) as total FROM seccio';
    const barriosParams = [];
    if (barrio_id) {
      barriosSql = 'SELECT COUNT(*) as total FROM seccio WHERE CODIGO_SEC = ?';
      barriosParams.push(parseInt(barrio_id));
    }
    const [[barrios]] = await req.db.query(barriosSql, barriosParams);
    const [[veedores]] = await req.db.query("SELECT COUNT(*) as total FROM usuarios WHERE rol='veedor'");

    res.json({
      total_electores: electores.total,
      confirmados: no_votaron.total, // map to no_votaron to maintain compatibility with front-end variables
      dudosos: 0,
      no_vota: 0,
      ausentes: 0,
      ya_votaron: votaron.total,
      no_votaron: no_votaron.total,
      total_mesas: mesas.total,
      total_barrios: barrios.total,
      total_veedores: veedores.total
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
