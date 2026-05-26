const express = require('express');
const { authMiddleware, checkPermiso } = require('./auth');
const router = express.Router();

// Listar electores con filtros de la base de datos real
router.get('/', authMiddleware, (req, res, next) => {
  // Si busca por texto, permitimos el acceso si tiene permiso de 'dashboard' o de 'electores'
  if (req.query.buscar) {
    req.db.query('SELECT permisos FROM usuarios WHERE id = ?', [req.user.id])
      .then(([rows]) => {
        if (rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });
        if (req.user.rol === 'admin') return next();
        let permisos = {};
        try {
          permisos = typeof rows[0].permisos === 'string' ? JSON.parse(rows[0].permisos) : (rows[0].permisos || {});
        } catch (e) {
          permisos = {};
        }
        if (permisos.dashboard === true || permisos.electores === true) {
          next();
        } else {
          res.status(403).json({ error: 'No tienes permisos para buscar electores.' });
        }
      })
      .catch(err => res.status(500).json({ error: err.message }));
  } else {
    checkPermiso('electores')(req, res, next);
  }
}, async (req, res) => {
  const { estado, barrio_id, mesa_id, buscar } = req.query;
  
  let sql = `
    SELECT 
      e.id, 
      CONCAT(e.NOMBRE, ' ', IFNULL(e.APELLIDO, '')) as nombre, 
      e.NUMERO_CED as ci, 
      e.DIRECCION as direccion, 
      e.CODIGO_SEC as barrio_id, 
      s.NDISTRITO as barrio_nombre, 
      e.MESA as mesa_numero, 
      sl.NOMBRE_LOC as mesa_local, 
      e.SEC_LOC as mesa_id,
      CASE WHEN e.votado = 1 THEN 'ya_voto' ELSE 'no_voto' END as estado,
      e.observaciones, 
      e.veedor_id, 
      u.nombre as veedor_nombre,
      e.lat_voto as lat,
      e.lng_voto as lng,
      e.ORDEN as orden
    FROM mas_pda e
    LEFT JOIN seccio s ON e.CODIGO_SEC = s.CODIGO_SEC
    LEFT JOIN secc_local sl ON e.SEC_LOC = sl.SECC_LOC
    LEFT JOIN usuarios u ON e.veedor_id = u.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (estado) {
    if (estado === 'ya_voto') {
      sql += ' AND e.votado = 1';
    } else if (estado === 'no_voto') {
      sql += ' AND e.votado = 0';
    }
  }
  
  if (barrio_id) {
    sql += ' AND e.CODIGO_SEC = ?';
    params.push(barrio_id);
  }
  
  if (mesa_id) {
    sql += ' AND e.SEC_LOC = ?';
    params.push(mesa_id);
  }
  
  if (buscar) {
    sql += ' AND (e.NOMBRE LIKE ? OR e.APELLIDO LIKE ? OR e.NUMERO_CED LIKE ?)';
    const searchParam = `%${buscar}%`;
    params.push(searchParam, searchParam, searchParam);
  }
  
  sql += ' ORDER BY e.APELLIDO, e.NOMBRE LIMIT 500'; // Limit results for performance on large databases
  
  try {
    const [rows] = await req.db.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear elector en la base de datos real (mas_pda)
router.post('/', authMiddleware, checkPermiso('cargar'), async (req, res) => {
  const { nombre, ci, telefono, direccion, barrio_id, mesa_id, estado, observaciones, lat, lng } = req.body;
  const veedor_id = req.user.id;
  
  // Split full name into first and last name heuristics
  const parts = (nombre || '').trim().split(' ');
  const first_name = parts[0] || '';
  const last_name = parts.slice(1).join(' ') || '';
  const votado = (estado === 'ya_voto') ? 1 : 0;
  
  let sec_loc = mesa_id ? parseInt(mesa_id) : null;
  let codigo_sec = barrio_id ? parseInt(barrio_id) : null;
  
  let mesa_num = 1;
  
  try {
    const [result] = await req.db.query(
      `INSERT INTO mas_pda (NOMBRE, APELLIDO, NUMERO_CED, DIRECCION, CODIGO_SEC, MESA, SEC_LOC, votado, observaciones, veedor_id, lat_voto, lng_voto, ORDEN)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, ci, direccion, codigo_sec, mesa_num, sec_loc, votado, observaciones, veedor_id, lat, lng, 999]
    );
    res.json({ id: result.insertId, success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar elector - Requiere permiso 'electores'
router.put('/:id', authMiddleware, checkPermiso('electores'), async (req, res) => {
  const { nombre, ci, telefono, direccion, barrio_id, mesa_id, estado, observaciones, lat, lng } = req.body;
  
  const parts = (nombre || '').trim().split(' ');
  const first_name = parts[0] || '';
  const last_name = parts.slice(1).join(' ') || '';
  const votado = (estado === 'ya_voto') ? 1 : 0;
  
  let sec_loc = mesa_id ? parseInt(mesa_id) : null;
  let codigo_sec = barrio_id ? parseInt(barrio_id) : null;
  
  try {
    await req.db.query(
      `UPDATE mas_pda SET 
        NOMBRE=?, 
        APELLIDO=?, 
        NUMERO_CED=?, 
        DIRECCION=?, 
        CODIGO_SEC=?, 
        SEC_LOC=?, 
        votado=?, 
        observaciones=?, 
        lat_voto=?, 
        lng_voto=?
       WHERE id=?`,
      [first_name, last_name, ci, direccion, codigo_sec, sec_loc, votado, observaciones, lat, lng, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar elector - Exclusivo de administrador
router.delete('/:id', authMiddleware, (req, res, next) => {
  if (req.user.rol === 'admin') next();
  else res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden eliminar electores.' });
}, async (req, res) => {
  try {
    await req.db.query('DELETE FROM mas_pda WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Estadisticas por estado - Requiere permiso 'dashboard'
router.get('/stats/resumen', authMiddleware, checkPermiso('dashboard'), async (req, res) => {
  try {
    const [rows] = await req.db.query(`
      SELECT 
        CASE WHEN votado = 1 THEN 'ya_voto' ELSE 'no_voto' END as estado, 
        COUNT(*) as cantidad 
      FROM mas_pda 
      GROUP BY votado
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
