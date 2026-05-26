const express = require('express');
const { authMiddleware } = require('./auth');
const router = express.Router();

router.post('/push', authMiddleware, async (req, res) => {
  const { electores } = req.body;
  const results = [];
  if (!Array.isArray(electores)) return res.status(400).json({ error: 'electores debe ser array' });

  for (const item of electores) {
    try {
      const parts = (item.nombre || '').trim().split(' ');
      const first_name = parts[0] || '';
      const last_name = parts.slice(1).join(' ') || '';
      const votado = (item.estado === 'ya_voto') ? 1 : 0;
      
      let sec_loc = item.mesa_id ? parseInt(item.mesa_id) : null;
      let codigo_sec = item.barrio_id ? parseInt(item.barrio_id) : null;

      if (item._localStatus === 'new' || !item.id) {
        const [r] = await req.db.query(
          `INSERT INTO mas_pda (NOMBRE, APELLIDO, NUMERO_CED, DIRECCION, CODIGO_SEC, MESA, SEC_LOC, votado, observaciones, veedor_id, lat_voto, lng_voto, ORDEN)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [first_name, last_name, item.ci, item.direccion, codigo_sec, 1, sec_loc, votado, item.observaciones, req.user.id, item.lat, item.lng, 999]
        );
        results.push({ localId: item._localId, serverId: r.insertId, status: 'created' });
      } else {
        await req.db.query(
          `UPDATE mas_pda SET 
            NOMBRE=?, APELLIDO=?, NUMERO_CED=?, DIRECCION=?, CODIGO_SEC=?, SEC_LOC=?, votado=?, observaciones=?, lat_voto=?, lng_voto=?
           WHERE id=?`,
          [first_name, last_name, item.ci, item.direccion, codigo_sec, sec_loc, votado, item.observaciones, item.lat, item.lng, item.id]
        );
        results.push({ localId: item._localId, serverId: item.id, status: 'updated' });
      }
    } catch (e) {
      results.push({ localId: item._localId, error: e.message });
    }
  }
  const broadcast = req.app.get('broadcast');
  if (broadcast) {
    broadcast({ type: 'sync_completo', user: req.user.nombre, count: electores.length });
  }
  res.json({ results });
});

module.exports = router;
